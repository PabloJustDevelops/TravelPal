import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TripJournal from "../TripJournal";
import { createInsforgeClient } from "@/lib/insforge";
import type { JournalEntry } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-a" }, loading: false }),
}));
// El diario y las fotos se prueban por separado: aqui el hijo se aísla para no
// mezclar sus estados con los de las entradas.
jest.mock("../JournalPhotos", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/lib/logger", () => ({
  logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock("@/lib/toast", () => ({ showToast: jest.fn() }));

type QueryResult = { data?: unknown; error?: unknown };

interface Chain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable". Cada terminal resuelve lo que le toca:
// la lectura resuelve las entradas y las escrituras resuelven sin error.
function makeChain(
  loadResult: QueryResult,
  writeResult: QueryResult = { data: null, error: null },
): Chain {
  let current = loadResult;
  const chain = {} as Chain;
  chain.select = jest.fn(() => {
    current = loadResult;
    return chain;
  });
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.insert = jest.fn(() => {
    current = writeResult;
    return chain;
  });
  chain.update = jest.fn(() => {
    current = writeResult;
    return chain;
  });
  chain.delete = jest.fn(() => {
    current = writeResult;
    return chain;
  });
  chain.then = (resolve) => Promise.resolve(current).then(resolve);
  return chain;
}

const mockedClient = createInsforgeClient as jest.Mock;

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "j1",
    user_id: "user-a",
    trip_id: "trip-1",
    entry_date: "2026-09-01",
    content: "Primer dia",
    rating: 5,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TripJournal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true) as unknown as typeof window.confirm;
  });

  it("ensena un estado de carga mientras lee las entradas", () => {
    const chain = makeChain({ data: [] });
    // Nunca resuelve: deja el componente en carga.
    chain.then = () => new Promise(() => {});
    mockedClient.mockReturnValue({ database: { from: jest.fn(() => chain) } });

    render(<TripJournal tripId="trip-1" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("invita a escribir cuando el diario esta vacio", async () => {
    const chain = makeChain({ data: [] });
    mockedClient.mockReturnValue({ database: { from: jest.fn(() => chain) } });

    render(<TripJournal tripId="trip-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("Todavía no has escrito el diario de este viaje"),
      ).toBeInTheDocument();
    });
  });

  it("ensena las entradas con su fecha, texto y valoracion", async () => {
    const chain = makeChain({
      data: [entry({ id: "j1", content: "Primer dia", rating: 5 })],
    });
    mockedClient.mockReturnValue({ database: { from: jest.fn(() => chain) } });

    render(<TripJournal tripId="trip-1" />);

    await waitFor(() => {
      expect(screen.getByText("Primer dia")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Valoración: 5 de 5")).toBeInTheDocument();
  });

  it("si falla la carga lo dice y permite reintentar", async () => {
    const chain = makeChain({ error: { message: "boom" } });
    mockedClient.mockReturnValue({ database: { from: jest.fn(() => chain) } });

    render(<TripJournal tripId="trip-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("No se pudo cargar el diario del viaje"),
      ).toBeInTheDocument();
    });

    const callsBefore = chain.select.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(chain.select.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("guarda una entrada nueva con el viaje y el usuario de la sesion", async () => {
    const chain = makeChain({ data: [] });
    mockedClient.mockReturnValue({ database: { from: jest.fn(() => chain) } });

    render(<TripJournal tripId="trip-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("Todavía no has escrito el diario de este viaje"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Añadir entrada" }));
    fireEvent.change(screen.getByLabelText("Cómo fue"), {
      target: { value: "Un dia redondo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar entrada" }));

    await waitFor(() => {
      expect(chain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          trip_id: "trip-1",
          user_id: "user-a",
          content: "Un dia redondo",
          rating: null,
        }),
      ]);
    });
  });

  it("borra una entrada y la quita de la lista", async () => {
    const chain = makeChain({
      data: [entry({ id: "j1", content: "Primer dia" })],
    });
    mockedClient.mockReturnValue({ database: { from: jest.fn(() => chain) } });

    render(<TripJournal tripId="trip-1" />);

    await waitFor(() => {
      expect(screen.getByText("Primer dia")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Borrar entrada" }));

    await waitFor(() => {
      expect(chain.delete).toHaveBeenCalled();
      expect(screen.queryByText("Primer dia")).not.toBeInTheDocument();
    });
  });
});
