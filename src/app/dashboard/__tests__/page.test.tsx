import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
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
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("jspdf", () => ({ __esModule: true, default: jest.fn() }));

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  gte: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cualquier terminal (order, gte) resuelve el
// resultado de su tabla.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}

const trip = {
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
};

const expense = {
  id: "expense-1",
  user_id: "user-123",
  trip_id: "trip-1",
  title: "Cena",
  amount: 42,
  currency: "USD",
  category: "food",
  date: "2026-05-02",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const budget = {
  id: "budget-1",
  name: "Presupuesto Roma",
  total_amount: 1500,
  spent_amount: 420,
  currency: "USD",
  category: "travel",
};

const mockedClient = createInsforgeClient as jest.Mock;

describe("DashboardPage con el SDK en el navegador", () => {
  let tripsChain: DbChain;
  let expensesChain: DbChain;
  let budgetsChain: DbChain;
  let fetchMock: jest.Mock;

  // Las tres lecturas del GET borrado llegan del SDK, tabla a tabla: ya no hay
  // ningun fetch en la pagina.
  function mount({
    tripsResult = { data: [trip], error: null },
    expensesResult = { data: [expense], error: null },
    budgetsResult = { data: [budget], error: null },
  }: {
    tripsResult?: QueryResult;
    expensesResult?: QueryResult;
    budgetsResult?: QueryResult;
  } = {}) {
    tripsChain = makeChain(tripsResult);
    expensesChain = makeChain(expensesResult);
    budgetsChain = makeChain(budgetsResult);
    const from = jest.fn((table: string) => {
      if (table === "trips") return tripsChain;
      if (table === "expenses") return expensesChain;
      return budgetsChain;
    });
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user-123", full_name: "Test User" },
      loading: false,
    });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lee viajes, gastos y presupuestos del SDK y los pinta, sin tocar /api/dashboard", async () => {
    const { from } = mount();

    render(<DashboardPage />);

    // El titulo del viaje se pinta en "Viajes Recientes": la lectura llego.
    expect(await screen.findByText("Escapada a Roma")).toBeInTheDocument();

    // Las tres consultas salen del SDK, tabla a tabla.
    expect(from).toHaveBeenCalledWith("trips");
    expect(from).toHaveBeenCalledWith("expenses");
    expect(from).toHaveBeenCalledWith("budgets");
    // Y ni una llamada al BFF: el camino migrado ya no pasa por fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pide el select, el filtro por usuario y el order de las tres consultas", async () => {
    mount();

    render(<DashboardPage />);

    await screen.findByText("Escapada a Roma");

    // Viajes: `*`, propietario y salida ascendente.
    expect(tripsChain.select).toHaveBeenCalledWith("*");
    expect(tripsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tripsChain.order).toHaveBeenCalledWith("departure_date", {
      ascending: true,
    });

    // Gastos: `*`, propietario y fecha descendente.
    expect(expensesChain.select).toHaveBeenCalledWith("*");
    expect(expensesChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(expensesChain.order).toHaveBeenCalledWith("date", {
      ascending: false,
    });

    // Presupuestos: `*`, propietario y creacion descendente.
    expect(budgetsChain.select).toHaveBeenCalledWith("*");
    expect(budgetsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(budgetsChain.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("acota viajes y gastos por el rango elegido, pero no los presupuestos", async () => {
    mount();

    render(<DashboardPage />);

    await screen.findByText("Escapada a Roma");

    // "Todo el tiempo" no acota nada.
    expect(tripsChain.gte).not.toHaveBeenCalled();
    expect(expensesChain.gte).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue("Todo el tiempo"), {
      target: { value: "30" },
    });

    // Con rango, viajes y gastos reciben su `gte` con el inicio calculado; los
    // presupuestos no tienen fecha de referencia y no se acotan.
    await waitFor(() => {
      expect(tripsChain.gte).toHaveBeenCalledWith(
        "departure_date",
        expect.any(String),
      );
    });
    expect(expensesChain.gte).toHaveBeenCalledWith("date", expect.any(String));
    expect(budgetsChain.gte).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK y ofrece reintentar por el SDK", async () => {
    mount({ tripsResult: { data: null, error: { message: "boom" } } });

    render(<DashboardPage />);

    expect(
      await screen.findByText(
        "Error al cargar los datos. Por favor, intenta recargar.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));

    // El reintento vuelve a leer del SDK, no del BFF.
    await waitFor(() => {
      expect(tripsChain.select).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no consulta el SDK si no hay usuario", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: false });
    const { from } = mount();

    render(<DashboardPage />);

    expect(await screen.findByText(/Bienvenido, Viajero/)).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
