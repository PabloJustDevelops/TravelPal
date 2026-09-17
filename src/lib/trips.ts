import { createInsforgeClient } from "@/lib/insforge";
import { assertRowsAffected, withQueryTimeout } from "@/lib/insforge-query";
import { logger } from "@/lib/logger";

/**
 * Tablas hijas del viaje, con su nombre en singular y plural para el aviso. Las
 * de `on delete cascade` caen solas con el viaje; las de `on delete set null`
 * (gastos y notas) sobreviven y el usuario elige si se borran o se quedan sin
 * viaje.
 *
 * `tasks` no aparece a proposito: no tiene `trip_id`, no cuelga del viaje (ver
 * `migrations/20260913181842_create-app-schema.sql`).
 */
interface ChildTableLabel {
  table: string;
  one: string;
  many: string;
}

const CASCADE_CHILD_TABLES: readonly ChildTableLabel[] = [
  {
    table: "itinerary_activities",
    one: "actividad del itinerario",
    many: "actividades del itinerario",
  },
  { table: "bookings", one: "reserva", many: "reservas" },
  { table: "reminders", one: "recordatorio", many: "recordatorios" },
  {
    table: "calendar_events",
    one: "evento del calendario",
    many: "eventos del calendario",
  },
  {
    table: "journal_entries",
    one: "entrada del diario",
    many: "entradas del diario",
  },
  { table: "journal_photos", one: "foto del diario", many: "fotos del diario" },
];

interface OptionalChildTable extends ChildTableLabel {
  // Como se nombran en el error ("los gastos", "las notas"): el genero cambia y
  // no se puede componer desde el plural.
  errorLabel: string;
}

const EXPENSES_TABLE: OptionalChildTable = {
  table: "expenses",
  one: "gasto",
  many: "gastos",
  errorLabel: "los gastos",
};

const NOTES_TABLE: OptionalChildTable = {
  table: "notes",
  one: "nota",
  many: "notas",
  errorLabel: "las notas",
};

export interface TripDeletionCount {
  table: string;
  one: string;
  many: string;
  count: number;
}

export interface TripDeletionImpact {
  cascading: TripDeletionCount[];
  expenses: TripDeletionCount;
  notes: TripDeletionCount;
}

export interface DeleteTripOptions {
  deleteExpenses?: boolean;
  deleteNotes?: boolean;
}

/**
 * Falla al borrar uno de los hijos opcionales (gastos o notas). El mensaje dice
 * lo que de verdad importa: el viaje sigue ahi, no se ha borrado a medias.
 */
export class TripChildDeletionError extends Error {
  constructor(errorLabel: string) {
    super(`No se pudieron eliminar ${errorLabel}; el viaje no se ha borrado.`);
    this.name = "TripChildDeletionError";
  }
}

function toDeletionCount(
  table: ChildTableLabel,
  count: number,
): TripDeletionCount {
  return { table: table.table, one: table.one, many: table.many, count };
}

/**
 * "3 actividades del itinerario, 1 reserva y 2 entradas del diario". Devuelve
 * `null` si no hay ninguna fila (o ninguna se pudo contar): asi el aviso omite
 * lo que no hay en vez de inventarlo.
 */
export function formatTripDeletionCounts(
  counts: readonly TripDeletionCount[],
): string | null {
  const parts = counts
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.count} ${entry.count === 1 ? entry.one : entry.many}`);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

async function countTripRows(
  insforge: ReturnType<typeof createInsforgeClient>,
  table: string,
  tripId: string,
): Promise<number | null> {
  const { count, error } = await withQueryTimeout(
    insforge.database
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId),
    { label: `${table}:count` },
  );

  if (error) throw error;
  return typeof count === "number" ? count : null;
}

/**
 * Cuenta, con el SDK y la sesion del usuario (RLS manda), las filas que cuelgan
 * del viaje. Una tabla que no se puede contar (error o RLS) se omite del
 * resultado: mejor decir menos que inventar un numero.
 */
export async function getTripDeletionImpact(
  tripId: string,
): Promise<TripDeletionImpact> {
  const insforge = createInsforgeClient();
  const tables: readonly ChildTableLabel[] = [
    ...CASCADE_CHILD_TABLES,
    EXPENSES_TABLE,
    NOTES_TABLE,
  ];
  const counts = new Map<string, number>();

  await Promise.all(
    tables.map(async (table) => {
      try {
        const count = await countTripRows(insforge, table.table, tripId);
        if (count !== null) counts.set(table.table, count);
      } catch (error) {
        logger.warn("getTripDeletionImpact: no se pudo contar la tabla", {
          table: table.table,
          error,
        });
      }
    }),
  );

  return {
    cascading: CASCADE_CHILD_TABLES.filter((table) =>
      counts.has(table.table),
    ).map((table) => toDeletionCount(table, counts.get(table.table) ?? 0)),
    expenses: toDeletionCount(EXPENSES_TABLE, counts.get("expenses") ?? 0),
    notes: toDeletionCount(NOTES_TABLE, counts.get("notes") ?? 0),
  };
}

async function deleteTripChildren(
  insforge: ReturnType<typeof createInsforgeClient>,
  table: OptionalChildTable,
  tripId: string,
): Promise<void> {
  const { data, error } = await withQueryTimeout(
    insforge.database.from(table.table).delete().eq("trip_id", tripId).select(),
    { label: `${table.table}:delete` },
  );

  if (error) throw new TripChildDeletionError(table.errorLabel);

  try {
    assertRowsAffected(data, table.errorLabel);
  } catch {
    // El fallo del helper no dice que el viaje sigue en pie; el error propio si.
    throw new TripChildDeletionError(table.errorLabel);
  }
}

/**
 * Borra el viaje del usuario autenticado por el SDK, sin claves de servicio: la
 * RLS de propietario decide si la fila cae y `.select()` obliga al backend a
 * devolver las filas afectadas, de modo que `assertRowsAffected` convierte el
 * cero filas en un fallo (ADR-009) en vez de cantar un exito que no ha ocurrido.
 *
 * Orden: primero los hijos `on delete set null` que el usuario haya decidido
 * borrar (gastos y notas) y el viaje al final. Al borrar el viaje su `trip_id`
 * se pone a `null` en esas filas, asi que despues ya no habria forma de
 * encontrarlas por su viaje; de ahi borrarlas antes. Si ese borrado opcional
 * falla se aborta antes de tocar el viaje: el viaje nunca se queda borrado a
 * medias (como mucho queda borrada parte de lo opcional). Las tablas que
 * cascadean (itinerario, reservas, recordatorios, eventos y diario) no se tocan
 * aqui: se van con el viaje.
 */
export async function deleteTrip(
  tripId: string,
  options: DeleteTripOptions = {},
): Promise<void> {
  const insforge = createInsforgeClient();

  if (options.deleteExpenses) {
    await deleteTripChildren(insforge, EXPENSES_TABLE, tripId);
  }
  if (options.deleteNotes) {
    await deleteTripChildren(insforge, NOTES_TABLE, tripId);
  }

  const { data: deletedRows, error } = await withQueryTimeout(
    insforge.database.from("trips").delete().eq("id", tripId).select(),
    { label: "trips:delete" },
  );

  if (error) throw error;
  assertRowsAffected(deletedRows, "No se pudo eliminar el viaje");
}
