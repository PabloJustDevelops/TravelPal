import {
  deleteTrip,
  formatTripDeletionCounts,
  getTripDeletionImpact,
  TripChildDeletionError,
  type TripDeletionCount,
} from "../trips";
import { createInsforgeClient } from "@/lib/insforge";
import { RowsNotAffectedError } from "@/lib/insforge-query";

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

type QueryResult = { data?: unknown; count?: number | null; error?: unknown };

interface DbChain {
  delete: jest.Mock;
  eq: jest.Mock;
  select: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cada metodo devuelve la propia cadena y el
// `await` del terminal resuelve el resultado configurado para esa tabla. Vale
// tanto para el borrado (delete().eq().select()) como para el conteo
// (select("*", opciones).eq()).
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.delete = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.select = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}

const mockedClient = createInsforgeClient as jest.Mock;

const ALL_TABLES = [
  "itinerary_activities",
  "bookings",
  "reminders",
  "calendar_events",
  "journal_entries",
  "journal_photos",
  "expenses",
  "notes",
] as const;

function mount(
  results: Record<string, QueryResult>,
  fallback: QueryResult = { data: [{ id: "ok" }], count: 0, error: null },
) {
  const chains = new Map<string, DbChain>();
  const from = jest.fn((table: string) => {
    const chain = makeChain(results[table] ?? fallback);
    chains.set(table, chain);
    return chain;
  });

  mockedClient.mockReturnValue({ database: { from } });
  return { from, chains };
}

describe("getTripDeletionImpact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cuenta con la sesion del usuario las tablas que cuelgan del viaje", async () => {
    const { from, chains } = mount({
      itinerary_activities: { data: null, count: 3, error: null },
      bookings: { data: null, count: 1, error: null },
      reminders: { data: null, count: 0, error: null },
      calendar_events: { data: null, count: 0, error: null },
      journal_entries: { data: null, count: 2, error: null },
      journal_photos: { data: null, count: 0, error: null },
      expenses: { data: null, count: 1, error: null },
      notes: { data: null, count: 2, error: null },
    });

    const impact = await getTripDeletionImpact("trip-1");

    expect(from.mock.calls.map(([table]) => table)).toEqual([...ALL_TABLES]);

    const counts = chains.get("itinerary_activities");
    expect(counts?.select).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
    expect(counts?.eq).toHaveBeenCalledWith("trip_id", "trip-1");

    expect(impact.cascading).toEqual([
      {
        table: "itinerary_activities",
        one: "actividad del itinerario",
        many: "actividades del itinerario",
        count: 3,
      },
      { table: "bookings", one: "reserva", many: "reservas", count: 1 },
      { table: "reminders", one: "recordatorio", many: "recordatorios", count: 0 },
      {
        table: "calendar_events",
        one: "evento del calendario",
        many: "eventos del calendario",
        count: 0,
      },
      {
        table: "journal_entries",
        one: "entrada del diario",
        many: "entradas del diario",
        count: 2,
      },
      {
        table: "journal_photos",
        one: "foto del diario",
        many: "fotos del diario",
        count: 0,
      },
    ]);
    expect(impact.expenses.count).toBe(1);
    expect(impact.notes.count).toBe(2);
  });

  it("omite del aviso la tabla que no se puede contar en vez de inventarla", async () => {
    const { from } = mount(
      { bookings: { data: null, count: null, error: { message: "boom" } } },
      { data: null, count: 0, error: null },
    );

    const impact = await getTripDeletionImpact("trip-1");

    expect(from).toHaveBeenCalledWith("bookings");
    expect(impact.cascading.some((entry) => entry.table === "bookings")).toBe(
      false,
    );
  });
});

describe("formatTripDeletionCounts", () => {
  function count(n: number, one: string, many: string): TripDeletionCount {
    return { table: one, one, many, count: n };
  }

  it("devuelve null cuando no hay filas", () => {
    expect(
      formatTripDeletionCounts([
        count(0, "gasto", "gastos"),
        count(0, "nota", "notas"),
      ]),
    ).toBeNull();
    expect(formatTripDeletionCounts([])).toBeNull();
  });

  it("concuerda el singular con una sola fila", () => {
    expect(formatTripDeletionCounts([count(1, "gasto", "gastos")])).toBe(
      "1 gasto",
    );
  });

  it("encadena varios conteos con comas y una y final", () => {
    expect(
      formatTripDeletionCounts([
        count(3, "actividad del itinerario", "actividades del itinerario"),
        count(1, "reserva", "reservas"),
        count(2, "entrada del diario", "entradas del diario"),
      ]),
    ).toBe("3 actividades del itinerario, 1 reserva y 2 entradas del diario");
  });
});

describe("deleteTrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sin opciones borra solo el viaje por su id y exige las filas afectadas", async () => {
    const { from, chains } = mount({});

    await deleteTrip("trip-1");

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("trips");

    const trips = chains.get("trips");
    expect(trips?.delete).toHaveBeenCalledTimes(1);
    expect(trips?.eq).toHaveBeenCalledWith("id", "trip-1");
    expect(trips?.select).toHaveBeenCalledTimes(1);
  });

  it("trata el cero filas como fallo: la RLS no dejo borrar", async () => {
    mount({ trips: { data: [], error: null } });

    await expect(deleteTrip("trip-1")).rejects.toBeInstanceOf(
      RowsNotAffectedError,
    );
  });

  it("propaga el error del SDK tal cual", async () => {
    mount({ trips: { data: null, error: { message: "boom" } } });

    await expect(deleteTrip("trip-1")).rejects.toEqual({ message: "boom" });
  });

  it("borra gastos y notas antes del viaje cuando se piden", async () => {
    const { from, chains } = mount({});

    await deleteTrip("trip-1", { deleteExpenses: true, deleteNotes: true });

    // Orden: primero los hijos `on delete set null`, el viaje al final.
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "expenses",
      "notes",
      "trips",
    ]);

    const expenses = chains.get("expenses");
    expect(expenses?.delete).toHaveBeenCalledTimes(1);
    expect(expenses?.eq).toHaveBeenCalledWith("trip_id", "trip-1");
    expect(expenses?.select).toHaveBeenCalledTimes(1);

    const notes = chains.get("notes");
    expect(notes?.eq).toHaveBeenCalledWith("trip_id", "trip-1");
  });

  it("no deja el viaje borrado a medias si falla un borrado opcional", async () => {
    const { from } = mount({
      notes: { data: null, error: { message: "boom" } },
    });

    await expect(
      deleteTrip("trip-1", { deleteExpenses: true, deleteNotes: true }),
    ).rejects.toBeInstanceOf(TripChildDeletionError);

    // El viaje no se toca: sin viaje no habria forma de volver a encontrar lo
    // que quedo sin borrar.
    expect(from).not.toHaveBeenCalledWith("trips");
  });

  it("tambien aborta si el borrado opcional no afecta a ninguna fila", async () => {
    const { from } = mount({ expenses: { data: [], error: null } });

    await expect(
      deleteTrip("trip-1", { deleteExpenses: true }),
    ).rejects.toBeInstanceOf(TripChildDeletionError);
    expect(from).not.toHaveBeenCalledWith("trips");
  });
});
