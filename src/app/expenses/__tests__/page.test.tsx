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
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  single: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": el terminal (order, single) resuelve el
// resultado de la lectura, que es lo que espera el `await` del componente.
// Las escrituras reutilizan ese mismo resultado, que no trae error.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  chain.single = jest.fn(() => chain);
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

// La tabla trae spent_amount 0: el "real" solo puede salir del cruce con gastos.
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
  let budgetsChain: DbChain;
  let fetchMock: jest.Mock;

  // Gastos, viajes y presupuestos llegan del SDK, tabla a tabla: ya no hay
  // ningun fetch en la pagina.
  function mount({
    expensesResult = { data: expenses, error: null },
    tripsResult = { data: trips, error: null },
    budgetsResult = { data: budgets, error: null },
  }: {
    expensesResult?: QueryResult;
    tripsResult?: QueryResult;
    budgetsResult?: QueryResult;
  } = {}) {
    expensesChain = makeChain(expensesResult);
    tripsChain = makeChain(tripsResult);
    budgetsChain = makeChain(budgetsResult);
    const from = jest.fn((table: string) => {
      if (table === "expenses") return expensesChain;
      if (table === "trips") return tripsChain;
      return budgetsChain;
    });
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  }

  // Intl inserta un espacio duro entre cifra y simbolo; las consultas de texto lo
  // colapsan a un espacio normal, asi que comparamos ya normalizado.
  const flat = (value: string) => value.replace(/\s+/g, " ");

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, loading: false });

    // La pagina migrada no debe tocar el BFF: cualquier fetch seria un fallo.
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lee gastos, viajes y presupuestos del SDK y los pinta, sin tocar ningun /api", async () => {
    const { from } = mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    // Las tres lecturas salen del SDK, tabla a tabla.
    expect(from).toHaveBeenCalledWith("expenses");
    expect(from).toHaveBeenCalledWith("trips");
    expect(from).toHaveBeenCalledWith("budgets");
    expect(screen.getByText("Cena en Trastevere")).toBeInTheDocument();
    expect(screen.getByText("Presupuesto Roma")).toBeInTheDocument();

    // Y ni una llamada al BFF: el camino migratedo ya no pasa por fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pide los select, filtros y orders de los handlers borrados", async () => {
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

    // El `*`, el filtro de usuario y el order del GET de presupuestos.
    expect(budgetsChain.select).toHaveBeenCalledWith("*");
    expect(budgetsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(budgetsChain.order).toHaveBeenCalledWith("created_at", {
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

    // El reintento vuelve a leer los gastos del SDK, no del BFF.
    expect(expensesChain.select).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK al leer los presupuestos", async () => {
    mount({ budgetsResult: { data: null, error: { message: "boom" } } });

    render(<ExpensesPage />);

    expect(
      await screen.findByText(
        "Error al cargar los gastos. Por favor, inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lee previsto frente a real y recalcula el gastado cruzando los gastos", async () => {
    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    // El listado de gastos sigue en pie.
    expect(screen.getByText("Cena en Trastevere")).toBeInTheDocument();

    // b1 (travel, 900/1000) y b2 (comida, 900/100) recalculan a 900: la tabla decia 0.
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

  it("crea un presupuesto por el SDK con el objeto y los defaults del handler", async () => {
    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    fireEvent.click(screen.getByText("Nuevo Presupuesto"));

    fireEvent.change(screen.getByLabelText("Nombre del Presupuesto"), {
      target: { value: "  Presupuesto Playa  " },
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
      expect(budgetsChain.insert).toHaveBeenCalled();
    });

    // El alta reproduce el insert del POST borrado: `user_id` lo ponia la API,
    // el nombre entra recortado y los opcionales vacios caen a null. La moneda
    // sale del formulario, cuyo valor inicial es el mismo default "USD".
    expect(budgetsChain.insert).toHaveBeenCalledWith([
      {
        user_id: "user-123",
        name: "Presupuesto Playa",
        total_amount: 500,
        currency: "USD",
        category: "food",
        start_date: "2026-07-01",
        end_date: "2026-07-10",
        trip_id: null,
        description: null,
      },
    ]);
    expect(budgetsChain.select).toHaveBeenCalledWith();
    expect(budgetsChain.single).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("edita con el update del handler, scopeado a id y user_id", async () => {
    mount();

    render(<ExpensesPage />);

    await screen.findByText("Mis Gastos");

    const card = screen.getByText("Presupuesto Roma").closest(".group");
    expect(card).not.toBeNull();
    const [editButton] = within(card as HTMLElement).getAllByRole("button");
    fireEvent.click(editButton);

    fireEvent.change(screen.getByLabelText("Nombre del Presupuesto"), {
      target: { value: "Presupuesto Roma 2026" },
    });
    fireEvent.change(screen.getByLabelText("Monto Total"), {
      target: { value: "1200" },
    });

    const submitButton = screen.getByText("Actualizar Presupuesto");
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(budgetsChain.update).toHaveBeenCalled();
    });

    // El update replica el PATCH borrado: mismos campos, el `updated_at`
    // explicito y el scope por id y usuario. Ni `user_id` ni `spent_amount`
    // viajan en el payload.
    const updatePayload = budgetsChain.update.mock.calls[0][0];
    expect(updatePayload).toEqual({
      name: "Presupuesto Roma 2026",
      total_amount: 1200,
      currency: "USD",
      category: "travel",
      start_date: "2026-05-01",
      end_date: "2026-05-07",
      trip_id: "trip-1",
      description: null,
      updated_at: expect.any(String),
    });
    expect(updatePayload).not.toHaveProperty("user_id");
    expect(updatePayload).not.toHaveProperty("spent_amount");
    expect(budgetsChain.eq).toHaveBeenCalledWith("id", "b1");
    expect(budgetsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("borra con el delete del handler, scopeado a id y user_id", async () => {
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
      expect(budgetsChain.delete).toHaveBeenCalled();
    });
    expect(budgetsChain.eq).toHaveBeenCalledWith("id", "b1");
    expect(budgetsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
