import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewExpensePage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Trip } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
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

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
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

let tripsChain: DbChain;
let fetchMock: jest.Mock;

function mount(result: QueryResult = { data: [trip], error: null }) {
  tripsChain = makeChain(result);
  const from = jest.fn(() => tripsChain);
  mockedClient.mockReturnValue({ database: { from } });
  return { from };
}

describe("NewExpensePage: selector de viajes por el SDK", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "expense-1" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
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

  it("sigue registrando el gasto por el BFF de gastos, que no se migra aqui", async () => {
    mount();

    render(<NewExpensePage />);

    await screen.findByRole("option", { name: "Escapada a Roma" });

    fireEvent.change(screen.getByLabelText(/Descripción/i), {
      target: { value: "Cena en Trastevere" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/i), {
      target: { value: "42.5" },
    });

    fireEvent.click(screen.getByText("Registrar Gasto"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/expenses",
        expect.objectContaining({ method: "POST" }),
      );
    });
    // El unico punto que se migra en esta pagina es el selector: el gasto
    // sigue escribiendo por su endpoint.
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/trips",
      expect.anything(),
    );
  });

  it("no bloquea el formulario si la lectura de viajes falla", async () => {
    mount({ data: null, error: { message: "boom" } });

    render(<NewExpensePage />);

    expect(await screen.findByLabelText(/Descripción/i)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Escapada a Roma" })).toBeNull();
  });
});
