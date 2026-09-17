import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import ExpensesPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient } from "@/lib/insforge";
import { formatCurrency } from "@/lib/utils";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/expenses",
}));
jest.mock("next/link", () => {
  const MockLink = ({ children }: { children: React.ReactNode }) => children;
  MockLink.displayName = "Link";
  return MockLink;
});
jest.mock("@/components/layout/DashboardLayout", () => {
  const MockLayout = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  MockLayout.displayName = "DashboardLayout";
  return MockLayout;
});
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": el terminal (order) resuelve el resultado de
// la lectura, que es lo que espera el `await` del componente.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}

// Copiado literal del select de viajes del handler borrado.
const TRIPS_SELECT =
  "id, title, user_id, origin, destination, departure_date, return_date, status, created_at, updated_at";

const mockUser = { id: "user-123", full_name: "Test User", email: "test@test.test" };

const trips = [
  {
    id: "trip-1",
    user_id: "user-123",
    title: "Escapada a Roma",
    origin: "Madrid",
    destination: "Roma",
    departure_date: "2026-05-01",
    return_date: "2026-05-07",
    status: "confirmed",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

// Gastos pensados para probar el recalculo: e1 y e2 dentro del periodo, e3 fuera
// de fechas, e4 en otra moneda. Ninguno debe colarse donde no aplica.
const expenses = [
  {
    id: "e1",
    user_id: "user-123",
    trip_id: "trip-1",
    title: "Cena en Trastevere",
    description: "Cena en Trastevere",
    amount: 900,
    currency: "USD",
    category: "food",
    date: "2026-05-02",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trip: { id: "trip-1", title: "Escapada a Roma" },
  },
  {
    id: "e2",
    user_id: "user-123",
    trip_id: null,
    title: "Taxi",
    description: "Taxi",
    amount: 50,
    currency: "USD",
    category: "transport",
    date: "2026-05-02",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trip: null,
  },
  {
    id: "e3",
    user_id: "user-123",
    trip_id: "trip-1",
    title: "Compra fuera de fechas",
    description: "Compra fuera de fechas",
    amount: 9999,
    currency: "USD",
    category: "food",
    date: "2026-06-30",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trip: null,
  },
  {
    id: "e4",
    user_id: "user-123",
    trip_id: "trip-1",
    title: "Gasto en otra moneda",
    description: "Gasto en otra moneda",
    amount: 9999,
    currency: "EUR",
    category: "food",
    date: "2026-05-02",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trip: null,
  },
];

// El API devuelve spent_amount 0: el "real" solo puede salir del cruce con gastos.
const budgets = [
  {
    id: "b1",
    name: "Presupuesto Roma",
    total_amount: 1000,
    spent_amount: 0,
    currency: "USD",
    category: "travel",
    trip_id: "trip-1",
    start_date: "2026-05-01",
    end_date: "2026-05-07",
    description: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "b2",
    name: "Presupuesto Comida",
    total_amount: 100,
    spent_amount: 0,
    currency: "USD",
    category: "food",
    trip_id: null,
    start_date: "2026-05-01",
    end_date: "2026-05-07",
    description: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const mockedClient = createInsforgeClient as jest.Mock;

describe("ExpensesPage con el presupuesto fusionado", () => {
  let expensesChain: DbChain;
  let tripsChain: DbChain;
  let fetchMock: jest.Mock;

  const jsonResponse = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => data,
  });

  function findCall(url: string, method: string) {
    return fetchMock.mock.calls.find(
      ([inputUrl, init]) =>
        inputUrl === url &&
        (init as RequestInit | undefined)?.method === method,
    );
  }

  // Los gastos y los viajes llegan del SDK; los presupuestos siguen por /api/budget.
  function mount({
    expensesResult = { data: expenses, error: null },
    tripsResult = { data: trips, error: null },
  }: {
    expensesResult?: QueryResult;
    tripsResult?: QueryResult;
  } = {}) {
    expensesChain = makeChain(expensesResult);
    tripsChain = makeChain(tripsResult);
    const from = jest.fn((table: string) =>
      table === "expenses" ? expensesChain : tripsChain,
    );
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  }

  // Intl inserta un espacio duro entre cifra y simbolo; las consultas de texto lo
  // colapsan a un espacio normal, asi que comparamos ya normalizado.
  const flat = (value: string) => value.replace(/\s+/g, " ");

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, loading: false });

    fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/budget" && method === "POST") {
        return Promise.resolve(jsonResponse({ id: "budget-new" }));
      }
      if (url.startsWith("/api/budget/")) {
        return Promise.resolve(jsonResponse({ id: "budget-deleted" }));
      }
      if (url.startsWith("/api/budget")) {
        return Promise.resolve(jsonResponse({ budgets, trips, expenses }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lee los gastos y los viajes del SDK y los pinta, sin tocar /api/expenses", async () => {
    const { from } = mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    // La lectura sale del SDK, tabla a tabla.
    expect(from).toHaveBeenCalledWith("expenses");
    expect(from).toHaveBeenCalledWith("trips");
    expect(screen.getByText("Cena en Trastevere")).toBeInTheDocument();

    // El unico fetch que queda es el de presupuestos, que no se migra aqui.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/budget");
  });

  it("pide el select con el viaje embebido y las columnas de viajes del handler", async () => {
    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    expect(expensesChain.select).toHaveBeenCalledWith("*, trip:trips(*)");
    expect(expensesChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(expensesChain.order).toHaveBeenCalledWith("date", {
      ascending: false,
    });

    expect(tripsChain.select).toHaveBeenCalledWith(TRIPS_SELECT);
    expect(tripsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tripsChain.order).toHaveBeenCalledWith("departure_date", {
      ascending: false,
    });
  });

  it("no se traga el error del SDK y ofrece reintentar por el SDK", async () => {
    mount({ expensesResult: { data: null, error: { message: "boom" } } });

    render(<ExpensesPage />);

    expect(
      await screen.findByText(
        "Error al cargar los gastos. Por favor, inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));

    // El reintento vuelve a leer los gastos del SDK, no del BFF: los unicos
    // fetch son los de presupuestos, que sigue en su endpoint.
    expect(expensesChain.select).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.every(([url]) => String(url).startsWith("/api/budget")),
    ).toBe(true);
  });

  it("lee previsto frente a real y recalcula el gastado cruzando los gastos", async () => {
    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    // El listado de gastos sigue en pie.
    expect(screen.getByText("Cena en Trastevere")).toBeInTheDocument();

    // b1 (travel, 900/1000) y b2 (comida, 900/100) recalculan a 900: el API decia 0.
    expect(
      screen.getAllByText(flat(`Gastado: ${formatCurrency(900, "USD")}`)),
    ).toHaveLength(2);

    // Contadores y totales sobre todos los presupuestos (1100 previsto, 1800 real).
    expect(screen.getByText("Presupuesto total").parentElement).toHaveTextContent(
      flat(formatCurrency(1100, "USD")),
    );
    expect(screen.getByText("Gastado").parentElement).toHaveTextContent(
      flat(formatCurrency(1800, "USD")),
    );
    expect(screen.getByText("Superados").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Cerca del límite").parentElement).toHaveTextContent("1");

    expect(screen.getByText("¡Presupuesto excedido!")).toBeInTheDocument();
    expect(
      screen.getByText("¡Cerca del límite del presupuesto!"),
    ).toBeInTheDocument();
  });

  it("usa el mismo bloque de filtros para gastos y presupuestos", async () => {
    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    fireEvent.change(screen.getByLabelText("Filtrar por categoría"), {
      target: { value: "food" },
    });

    // Presupuestos: sobrevive el de comida, el de viaje se filtra.
    expect(screen.getByText("Presupuesto Comida")).toBeInTheDocument();
    expect(screen.queryByText("Presupuesto Roma")).not.toBeInTheDocument();

    // Gastos: la cena (food) sigue, el taxi (transport) no.
    expect(screen.getByText("Cena en Trastevere")).toBeInTheDocument();
    expect(screen.queryByText("Taxi")).not.toBeInTheDocument();
  });

  it("crea un presupuesto desde el modal y hace POST a /api/budget", async () => {
    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    fireEvent.click(screen.getByText("Nuevo Presupuesto"));

    fireEvent.change(screen.getByLabelText("Nombre del Presupuesto"), {
      target: { value: "Presupuesto Playa" },
    });
    fireEvent.change(screen.getByLabelText("Monto Total"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Categoría"), {
      target: { value: "food" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de Inicio"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de Fin"), {
      target: { value: "2026-07-10" },
    });

    const submitButton = screen.getByText("Crear Presupuesto");
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(findCall("/api/budget", "POST")).toBeDefined();
    });

    const postCall = findCall("/api/budget", "POST");
    const payload = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(payload).toEqual(
      expect.objectContaining({
        name: "Presupuesto Playa",
        total_amount: 500,
        category: "food",
        start_date: "2026-07-01",
        end_date: "2026-07-10",
      }),
    );
  });

  it("borra un presupuesto desde su tarjeta y hace DELETE a /api/budget/:id", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);

    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    const card = screen.getByText("Presupuesto Roma").closest(".group");
    expect(card).not.toBeNull();

    const deleteButton = within(card as HTMLElement)
      .getAllByRole("button")
      .find((button) => button.className.includes("text-danger"));
    expect(deleteButton).toBeDefined();

    fireEvent.click(deleteButton as HTMLElement);

    await waitFor(() => {
      expect(findCall("/api/budget/b1", "DELETE")).toBeDefined();
    });
  });
});
