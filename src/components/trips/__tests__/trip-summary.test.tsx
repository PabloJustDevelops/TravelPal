import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TripSummary from "../TripSummary";
import { createInsforgeClient } from "@/lib/insforge";

jest.mock("@/lib/logger", () => ({
  logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

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

// Cadena encadenable y "awaitable": cualquier terminal resuelve el resultado cargado.
function makeChain(loadResult: QueryResult): Chain {
  const chain = {} as Chain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(loadResult).then(resolve);
  return chain;
}

const mockedClient = createInsforgeClient as jest.Mock;

function mockTables(results: Record<string, QueryResult>) {
  mockedClient.mockReturnValue({
    database: {
      from: jest.fn((table: string) => makeChain(results[table] ?? { data: [] })),
    },
  });
}

describe("TripSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ensena un estado de carga mientras lee gastos y reservas", () => {
    const chain = makeChain({ data: [] });
    // Nunca resuelve: deja el componente en carga.
    chain.then = () => new Promise(() => {});
    mockedClient.mockReturnValue({
      database: { from: jest.fn(() => chain) },
    });

    render(<TripSummary tripId="trip-1" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Resumen del viaje")).not.toBeInTheDocument();
  });

  it("muestra el estado vacio cuando el viaje no tiene gastos ni reservas", async () => {
    mockTables({ expenses: { data: [] }, bookings: { data: [] } });

    render(<TripSummary tripId="trip-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("Sin gastos ni reservas todavia"),
      ).toBeInTheDocument();
    });
  });

  it("ensena las cifras de gastos y reservas que ya existen", async () => {
    mockTables({
      expenses: {
        data: [
          { id: "e1", amount: 100, currency: "EUR" },
          { id: "e2", amount: 50, currency: "EUR" },
        ],
      },
      bookings: {
        data: [{ id: "b1", cost: 200, currency: "EUR" }],
      },
    });

    render(<TripSummary tripId="trip-1" />);

    await waitFor(() => {
      expect(screen.getByText("Resumen del viaje")).toBeInTheDocument();
    });

    expect(screen.getByText("150,00 €")).toBeInTheDocument();
    expect(screen.getByText("200,00 €")).toBeInTheDocument();
  });

  it("muestra el mensaje de timeout cuando la lectura no responde", async () => {
    jest.useFakeTimers();

    try {
      const chain = makeChain({ data: [] });
      // Nunca resuelve: sin el envoltorio el componente se queda cargando y el
      // mensaje de timeout no llega a pintarse.
      chain.then = () => new Promise(() => {});
      mockedClient.mockReturnValue({ database: { from: jest.fn(() => chain) } });

      render(<TripSummary tripId="trip-1" />);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });

      expect(
        screen.getByText("La carga del resumen ha tardado demasiado."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("No se pudo cargar el resumen del viaje"),
      ).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("si falla la carga lo dice y ofrece reintentar", async () => {
    const from = jest.fn(() =>
      makeChain({ error: { message: "boom" } }),
    );
    mockedClient.mockReturnValue({ database: { from } });

    render(<TripSummary tripId="trip-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("No se pudo cargar el resumen del viaje"),
      ).toBeInTheDocument();
    });

    const callsBefore = from.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(from.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
