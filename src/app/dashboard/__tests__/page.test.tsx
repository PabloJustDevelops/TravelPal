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
  neq: jest.Mock;
  order: jest.Mock;
  gte: jest.Mock;
  limit: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cualquier terminal (order, gte) resuelve el
// resultado de su tabla.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.neq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
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
  trip_id: "trip-1",
  name: "Presupuesto Roma",
  total_amount: 1500,
  spent_amount: 420,
  currency: "USD",
  category: "travel",
  start_date: "2026-05-01",
  end_date: "2026-05-07",
};

const itineraryActivity = {
  id: "activity-1",
  user_id: "user-123",
  trip_id: "trip-1",
  title: "Paseo por Trastevere",
  description: "Recorrido a pie",
  date: "2099-05-02",
  start_time: "09:30",
  order_index: 0,
  completed: false,
};

const pendingTask = {
  id: "task-1",
  user_id: "user-123",
  title: "Confirmar alojamiento",
  status: "pending",
  priority: "high",
  due_date: "2099-05-03T09:00:00.000Z",
};

const futureTrip = {
  ...trip,
  departure_date: "2099-05-01",
  return_date: "2099-05-07",
};

const mockedClient = createInsforgeClient as jest.Mock;

describe("DashboardPage con el SDK en el navegador", () => {
  let tripsChain: DbChain;
  let expensesChain: DbChain;
  let expensesChains: DbChain[];
  let budgetsChain: DbChain;
  let tasksChain: DbChain;
  let activitiesChain: DbChain;
  let fetchMock: jest.Mock;

  // Las tres lecturas del GET borrado llegan del SDK, tabla a tabla: ya no hay
  // ningun fetch en la pagina.
  function mount({
    tripsResult = { data: [trip], error: null },
    expensesResult = { data: [expense], error: null },
    budgetExpensesResult = { data: [expense], error: null },
    budgetsResult = { data: [budget], error: null },
    tasksResult = { data: [pendingTask], error: null },
    activitiesResult = { data: [itineraryActivity], error: null },
  }: {
    tripsResult?: QueryResult;
    expensesResult?: QueryResult;
    budgetExpensesResult?: QueryResult;
    budgetsResult?: QueryResult;
    tasksResult?: QueryResult;
    activitiesResult?: QueryResult;
  } = {}) {
    tripsChain = makeChain(tripsResult);
    expensesChain = makeChain(expensesResult);
    expensesChains = [expensesChain];
    budgetsChain = makeChain(budgetsResult);
    tasksChain = makeChain(tasksResult);
    activitiesChain = makeChain(activitiesResult);
    let expenseQueryIndex = 0;
    const from = jest.fn((table: string) => {
      if (table === "trips") return tripsChain;
      if (table === "expenses") {
        if (expenseQueryIndex++ === 0) return expensesChain;
        const chain = makeChain(budgetExpensesResult);
        expensesChains.push(chain);
        return chain;
      }
      if (table === "budgets") return budgetsChain;
      if (table === "tasks") return tasksChain;
      return activitiesChain;
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

  it("integra el itinerario del próximo viaje, tareas generales y presupuestos vinculados", async () => {
    const { from } = mount({ tripsResult: { data: [futureTrip], error: null } });

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Los primeros planes" })).toBeInTheDocument();
    expect(screen.getByText("Paseo por Trastevere")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Antes de salir" })).toBeInTheDocument();
    expect(screen.getByText("Confirmar alojamiento")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Presupuesto del viaje" })).toBeInTheDocument();
    expect(screen.getByText("Presupuesto Roma")).toBeInTheDocument();

    expect(from).toHaveBeenCalledWith("tasks");
    expect(from).toHaveBeenCalledWith("itinerary_activities");
    expect(tasksChain.select).toHaveBeenCalledWith("id, title, status, due_date");
    expect(tasksChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tasksChain.neq).toHaveBeenCalledWith("status", "completed");
    expect(tasksChain.order).toHaveBeenCalledWith("due_date", { ascending: true });
    expect(tasksChain.limit).toHaveBeenCalledWith(6);
    expect(activitiesChain.select).toHaveBeenCalledWith(
      "id, trip_id, date, title, description, start_time, location, completed",
    );
    expect(activitiesChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(activitiesChain.eq).toHaveBeenCalledWith("trip_id", "trip-1");
    expect(activitiesChain.limit).toHaveBeenCalledWith(3);
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
    expect(expensesChains.some((chain) =>
      chain.gte.mock.calls.some(([column]) => column === "date"),
    )).toBe(true);
    expect(budgetsChain.gte).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mantiene el rango del informe y carga gastos completos para el gasto real de presupuestos", async () => {
    mount();

    render(<DashboardPage />);
    await screen.findByText("Escapada a Roma");
    fireEvent.change(screen.getByDisplayValue("Todo el tiempo"), {
      target: { value: "30" },
    });

    await waitFor(() => expect(expensesChains).toHaveLength(3));

    expect(expensesChains[1].gte).toHaveBeenCalledWith("date", expect.any(String));
    expect(expensesChains[2].select).toHaveBeenCalledWith(
      "id, trip_id, date, amount, currency, category",
    );
    expect(expensesChains[2].eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(expensesChains[2].gte).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK y ofrece reintentar por el SDK", async () => {
    mount({ tripsResult: { data: null, error: { message: "boom" } } });

    render(<DashboardPage />);

    expect(
      await screen.findByText(
        "Error al cargar los datos. Por favor, intenta recargar.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Error al cargar el dashboard");

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
