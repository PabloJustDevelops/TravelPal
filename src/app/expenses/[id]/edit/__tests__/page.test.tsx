import { render, screen, waitFor } from "@testing-library/react";
import EditExpensePage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Trip } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({ id: "e1" }),
  usePathname: () => "/expenses/e1/edit",
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

const expense = {
  id: "e1",
  user_id: "user-123",
  trip_id: "trip-1",
  title: "Cena en Trastevere",
  description: "Cena en Trastevere",
  amount: 42.5,
  currency: "EUR",
  category: "food",
  date: "2026-05-02T20:00:00.000Z",
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

describe("EditExpensePage: selector de viajes por el SDK", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => expense,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("carga el viaje del selector por el SDK y el gasto por su endpoint", async () => {
    const { from } = mount();

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    // El selector sale del SDK, con el select, filtro y order del handler.
    expect(from).toHaveBeenCalledWith("trips");
    expect(tripsChain.select).toHaveBeenCalledWith("*");
    expect(tripsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tripsChain.order).toHaveBeenCalledWith("departure_date", {
      ascending: false,
    });
    expect(
      screen.getByRole("option", { name: "Escapada a Roma" }),
    ).toBeInTheDocument();

    // El gasto sigue leyendose por su endpoint, que no se migra aqui.
    expect(fetchMock).toHaveBeenCalledWith("/api/expenses/e1");
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/trips"),
    ).toBe(false);
  });

  it("no bloquea el gasto si la lectura de viajes falla", async () => {
    mount({ data: null, error: { message: "boom" } });

    render(<EditExpensePage />);

    // El error de los viajes solo dejaba el selector vacio (mismo contrato que
    // antes): el gasto se carga igual.
    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });
    expect(screen.queryByRole("option", { name: "Escapada a Roma" })).toBeNull();
  });
});
