import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewTripPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createInsforgeClient } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  __esModule: true,
  useAuth: jest.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: () => "/trips/new",
}));

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  insert: jest.Mock;
  select: jest.Mock;
  single: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": el terminal (single) resuelve el resultado
// del alta, que trae el id con el que la pagina navega al detalle.
function makeChain(
  result: QueryResult = { data: { id: "new-trip-id" }, error: null },
): DbChain {
  const chain = {} as DbChain;
  chain.insert = jest.fn(() => chain);
  chain.select = jest.fn(() => chain);
  chain.single = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}

const mockedClient = createInsforgeClient as jest.Mock;

describe("NewTripPage con el SDK en el navegador", () => {
  const mockPush = jest.fn();
  let insertChain: DbChain;
  let fetchMock: jest.Mock;

  const jsonResponse = (data: unknown, ok = true, status = 200) => ({
    ok,
    status,
    json: async () => data,
  });

  const mount = (
    result: QueryResult = { data: { id: "new-trip-id" }, error: null },
  ) => {
    insertChain = makeChain(result);
    const from = jest.fn(() => insertChain);
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "test-user-id" } });
    fetchMock = jest.fn().mockResolvedValue(jsonResponse({ id: "budget-1" }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function fillRequiredFields() {
    fireEvent.change(screen.getByLabelText(/Título del Viaje/i), {
      target: { value: "Test Trip" },
    });
    fireEvent.change(screen.getByLabelText(/Origen/i), {
      target: { value: "Madrid" },
    });
    fireEvent.change(screen.getByLabelText(/Destino/i), {
      target: { value: "Paris" },
    });
    fireEvent.change(screen.getByLabelText(/Fecha de Salida/i), {
      target: { value: "2025-01-01T10:00" },
    });
  }

  it("crea el viaje por el SDK con los campos del handler y navega al detalle", async () => {
    mount();

    render(<NewTripPage />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Código de Confirmación/i), {
      target: { value: "CONF123" },
    });
    fireEvent.change(screen.getByLabelText(/Número de Personas/i), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/Presupuesto Estimado/i), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByText("Crear Viaje"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/trips/new-trip-id");
    });

    // El alta reproduce el objeto de insercion del handler borrado: el user_id
    // lo ponia la API, y los opcionales vacios caian a null.
    expect(insertChain.insert).toHaveBeenCalledWith([
      {
        user_id: "test-user-id",
        title: "Test Trip",
        origin: "Madrid",
        destination: "Paris",
        departure_date: "2025-01-01T10:00",
        return_date: null,
        airline: null,
        flight_number: null,
        confirmation_number: "CONF123",
        notes: "Viajeros: 2",
        status: "planned",
      },
    ]);
    expect(insertChain.select).toHaveBeenCalledWith();
    expect(insertChain.single).toHaveBeenCalled();

    // El viaje ya no pasa por el BFF: el unico fetch que queda es el del
    // presupuesto, que es de otro dominio y no se migra en este PR.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const budgetCall = fetchMock.mock.calls[0];
    expect(budgetCall[0]).toBe("/api/budget");
    const budgetPayload = JSON.parse(budgetCall[1].body);
    expect(budgetPayload).toEqual(
      expect.objectContaining({
        name: "Presupuesto General",
        total_amount: 1000,
        trip_id: "new-trip-id",
      }),
    );
  });

  it("no se traga el error del SDK y no navega", async () => {
    mount({ data: null, error: { message: "Database error occurred" } });

    render(<NewTripPage />);

    fillRequiredFields();
    fireEvent.click(screen.getByText("Crear Viaje"));

    await waitFor(() => {
      expect(screen.getByText("Database error occurred")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("valida los campos obligatorios antes de llamar al SDK", async () => {
    mount();

    render(<NewTripPage />);

    // Se lanza el submit a mano: el `required` nativo de los inputs bloquearia
    // el click y no llegariamos al prechequeo del componente.
    const form = screen.getByText("Crear Viaje").closest("form");
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText("Por favor completa todos los campos requeridos"),
      ).toBeInTheDocument();
    });
    expect(insertChain.insert).not.toHaveBeenCalled();
  });

  it("rechaza una fecha de regreso anterior a la de salida", async () => {
    mount();

    render(<NewTripPage />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Fecha de Regreso/i), {
      target: { value: "2024-12-31T10:00" },
    });

    fireEvent.click(screen.getByText("Crear Viaje"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "La fecha de regreso debe ser posterior a la fecha de salida",
        ),
      ).toBeInTheDocument();
    });
    expect(insertChain.insert).not.toHaveBeenCalled();
  });
});
