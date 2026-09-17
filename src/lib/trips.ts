import { createInsforgeClient } from "@/lib/insforge";
import { assertRowsAffected, withQueryTimeout } from "@/lib/insforge-query";

/**
 * Texto de la confirmacion previa al borrado. Dice lo que se lleva el viaje por
 * delante y, sobre todo, lo que no: `expenses` y `notes` son `on delete set
 * null`, asi que sus filas no se borran, se quedan sin viaje.
 */
export function tripDeletionConfirmationMessage(title: string): string {
  return (
    `¿Seguro que quieres eliminar el viaje "${title}"? Se borrarán también su ` +
    `itinerario, sus reservas y su diario. Los gastos y las notas no se borran: ` +
    `se quedan sin viaje.`
  );
}

/**
 * Borra el viaje del usuario autenticado por el SDK, sin claves de servicio: la
 * RLS de propietario decide si la fila cae y `.select()` obliga al backend a
 * devolver las filas afectadas, de modo que `assertRowsAffected` convierte el
 * cero filas en un fallo (ADR-009) en vez de cantar un exito que no ha ocurrido.
 *
 * El esquema arrastra las tablas hijas que cascadean (itinerario, reservas,
 * recordatorios, eventos de calendario y diario). `expenses` y `notes` son
 * `on delete set null`: sus filas sobreviven al viaje y se quedan sin `trip_id`,
 * por eso el dialogo lo avisa antes de borrar.
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const insforge = createInsforgeClient();

  const { data: deletedRows, error } = await withQueryTimeout(
    insforge.database.from("trips").delete().eq("id", tripId).select(),
    { label: "trips:delete" },
  );

  if (error) throw error;
  assertRowsAffected(deletedRows, "No se pudo eliminar el viaje");
}
