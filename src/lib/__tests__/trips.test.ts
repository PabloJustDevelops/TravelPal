import { deleteTrip, tripDeletionConfirmationMessage } from "../trips";
import { createInsforgeClient } from "@/lib/insforge";
import { RowsNotAffectedError } from "@/lib/insforge-query";

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  delete: jest.Mock;
  eq: jest.Mock;
  select: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": el terminal (`select`) resuelve el
// resultado del borrado, que es lo que espera el `await` de `deleteTrip`.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.delete = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.select = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}

const mockedClient = createInsforgeClient as jest.Mock;

function mount(result: QueryResult) {
  const chain = makeChain(result);
  const from = jest.fn(() => chain);
  mockedClient.mockReturnValue({ database: { from } });
  return { from, chain };
}

describe("deleteTrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("borra el viaje por su id y exige las filas afectadas", async () => {
    const { from, chain } = mount({ data: [{ id: "trip-1" }], error: null });

    await deleteTrip("trip-1");

    expect(from).toHaveBeenCalledWith("trips");
    expect(chain.delete).toHaveBeenCalledTimes(1);
    expect(chain.eq).toHaveBeenCalledWith("id", "trip-1");
    expect(chain.select).toHaveBeenCalledTimes(1);
  });

  it("trata el cero filas como fallo: la RLS no dejo borrar", async () => {
    mount({ data: [], error: null });

    await expect(deleteTrip("trip-1")).rejects.toBeInstanceOf(
      RowsNotAffectedError,
    );
  });

  it("propaga el error del SDK tal cual", async () => {
    mount({ data: null, error: { message: "boom" } });

    await expect(deleteTrip("trip-1")).rejects.toEqual({ message: "boom" });
  });
});

describe("tripDeletionConfirmationMessage", () => {
  it("nombra el viaje y avisa de que los gastos y las notas no se borran", () => {
    const message = tripDeletionConfirmationMessage("Escapada a Roma");

    expect(message).toContain('"Escapada a Roma"');
    expect(message).toMatch(/se borrar/i);
    expect(message).toMatch(/los gastos y las notas no se borran/i);
    expect(message).toMatch(/se quedan sin viaje/i);
  });
});
