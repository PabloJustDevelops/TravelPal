import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewExpensePage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createInsforgeClient, type Trip } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: () => "/expenses/new",
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
  single: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cualquier terminal (order, single) resuelve
// el resultado que se le haya dado a la tabla.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.single = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}

const trip: Trip = {
  id: "trip-1",
  user_id: "user-123",
  title: "Escapada a Roma",
  origin: "Madrid",
  destination: "Roma",
  departure_date: "2026-05-01T10:00:00.000Z",
  return_date: "2026-05-07T18:00:00.000Z",
  status: "confirmed",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mockedClient = createInsforgeClient as jest.Mock;

describe("NewExpensePage con el SDK en el navegador", () => {
  const mockPush = jest.fn();
  let tripsChain: DbChain;
  let expensesChain: DbChain;
  let fetchMock: jest.Mock;

  function mount({
    tripsResult = { data: [trip], error: null },
    insertResult = { data: { id: "expense-1" }, error: null },
  }: {
    tripsResult?: QueryResult;
    insertResult?: QueryResult;
  } = {}) {
    tripsChain = makeChain(tripsResult);
    expensesChain = makeChain(insertResult);
    const from = jest.fn((table: string) =>
      table === "trips" ? tripsChain : expensesChain,
    );
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  }

  function fillRequiredFields(
    description = "Cena en Trastevere",
    amount = "42.5",
  ) {
    fireEvent.change(screen.getByLabelText(/Descripción/i), {
      target: { value: description },
    });
    fireEvent.change(screen.getByLabelText(/Monto/i), {
      target: { value: amount },
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("carga los viajes del selector por el SDK, sin tocar /api/trips", async () => {
    const { from } = mount();

    render(<NewExpensePage />);

    expect(
      await screen.findByRole("option", { name: "Escapada a Roma" }),
    ).toBeInTheDocument();

    expect(from).toHaveBeenCalledWith("trips");
    expect(tripsChain.select).toHaveBeenCalledWith("*");
    expect(tripsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tripsChain.order).toHaveBeenCalledWith("departure_date", {
      ascending: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registra el gasto por el SDK, con los campos del POST, y navega a la lista", async () => {
    mount();

    render(<NewExpensePage />);

    await screen.findByRole("option", { name: "Escapada a Roma" });

    fillRequiredFields();
    fireEvent.click(screen.getByText("Registrar Gasto"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/expenses");
    });

    expect(expensesChain.insert).toHaveBeenCalledWith([
      {
        user_id: "user-123",
        title: "Cena en Trastevere",
        amount: 42.5,
        currency: "EUR",
        category: "other",
        date: expect.any(String),
        trip_id: null,
        description: null,
      },
    ]);
    expect(expensesChain.select).toHaveBeenCalledWith();
    expect(expensesChain.single).toHaveBeenCalled();

    // El alta ya no pasa por el BFF: ningun fetch en toda la pantalla.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fija el mapeo no identidad: la descripcion va a title y las notas a la columna description", async () => {
    mount();

    render(<NewExpensePage />);

    await screen.findByRole("option", { name: "Escapada a Roma" });

    fillRequiredFields("Cena en Trastevere", "42.5");
    fireEvent.change(
      screen.getByPlaceholderText(/Añade detalles adicionales sobre este gasto/i),
      { target: { value: "Mesa junto a la ventana" } },
    );

    fireEvent.click(screen.getByText("Registrar Gasto"));

    await waitFor(() => {
      expect(expensesChain.insert).toHaveBeenCalled();
    });

    // `title` es NOT NULL en el esquema y `description` es la columna opcional:
    // si alguien invierte el mapeo, este objeto deja de coincidir.
    const [row] = expensesChain.insert.mock.calls[0][0];
    expect(row.title).toBe("Cena en Trastevere");
    expect(row.description).toBe("Mesa junto a la ventana");
    expect(row.title).not.toBe(row.description);
  });

  it("deja en null el viaje y las notas vacios, como el handler", async () => {
    mount();

    render(<NewExpensePage />);

    await screen.findByRole("option", { name: "Escapada a Roma" });

    fillRequiredFields();

    // El formulario manda `notes: ''` y `trip_id: ''`; el handler los pasaba a
    // null antes de insertar.
    fireEvent.click(screen.getByText("Registrar Gasto"));

    await waitFor(() => {
      expect(expensesChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({ trip_id: null, description: null }),
      ]);
    });
  });

  it("no se traga el error del SDK ni navega", async () => {
    mount({ insertResult: { data: null, error: { message: "Database error" } } });

    render(<NewExpensePage />);

    await screen.findByRole("option", { name: "Escapada a Roma" });

    fillRequiredFields();
    fireEvent.click(screen.getByText("Registrar Gasto"));

    await waitFor(() => {
      expect(screen.getByText("Database error")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("valida los campos obligatorios antes de llamar al SDK", async () => {
    mount();

    render(<NewExpensePage />);

    await screen.findByRole("option", { name: "Escapada a Roma" });

    // Se lanza el submit a mano: el `required` nativo de los inputs bloquearia
    // el click y no llegariamos al prechequeo del componente.
    const form = screen.getByText("Registrar Gasto").closest("form");
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText("Por favor completa todos los campos requeridos"),
      ).toBeInTheDocument();
    });
    expect(expensesChain.insert).not.toHaveBeenCalled();
  });

  it("no bloquea el formulario si la lectura de viajes falla", async () => {
    mount({ tripsResult: { data: null, error: { message: "boom" } } });

    render(<NewExpensePage />);

    expect(await screen.findByLabelText(/Descripción/i)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Escapada a Roma" })).toBeNull();
  });
});
