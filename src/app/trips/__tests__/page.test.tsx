import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TripsPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Trip } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
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
  delete: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": el terminal (order) resuelve el resultado de
// la lectura, que es lo que espera el `await` del componente. El borrado reusa
// la misma cadena, asi que resuelve el mismo resultado (una fila) y
// `assertRowsAffected` lo da por bueno.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
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
  airline: "Iberia",
  flight_number: "IB3201",
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

describe("TripsPage con el SDK en el navegador", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user-123" },
      loading: false,
    });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lee los viajes del SDK y los pinta, sin tocar /api/trips", async () => {
    const { from } = mount();

    render(<TripsPage />);

    expect(await screen.findByText("Escapada a Roma")).toBeInTheDocument();

    // La lectura sale del SDK, tabla a tabla.
    expect(from).toHaveBeenCalledWith("trips");
    // Y ni una llamada al BFF: el camino migrado ya no pasa por fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("destaca el viaje más próximo y deja visibles las acciones de detalle y borrado", async () => {
    const now = Date.now();
    const pastTrip: Trip = {
      ...trip,
      departure_date: new Date(now - 365 * 86_400_000).toISOString(),
      return_date: new Date(now - 360 * 86_400_000).toISOString(),
      status: "completed",
    };
    const upcomingTrip: Trip = {
      ...trip,
      id: "trip-upcoming",
      title: "Viaje en camino",
      departure_date: new Date(now + 14 * 86_400_000).toISOString(),
      return_date: new Date(now + 19 * 86_400_000).toISOString(),
      status: "planned",
    };
    mount({ data: [pastTrip, upcomingTrip], error: null });

    render(<TripsPage />);

    const featuredLabel = await screen.findByText("El próximo");
    const featured = featuredLabel.closest("article");
    expect(featured).not.toBeNull();
    expect(within(featured as HTMLElement).getByRole("heading", { name: "Viaje en camino" })).toBeInTheDocument();
    expect(within(featured as HTMLElement).getByText("Abrir viaje")).toBeInTheDocument();
    expect(within(featured as HTMLElement).getByRole("button", { name: "Eliminar el viaje Viaje en camino" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Para recordar" })).toBeInTheDocument();
    expect(screen.getByText("Ver viaje")).toBeInTheDocument();
  });

  it("pide el select, el filtro por usuario y el order del handler borrado", async () => {
    mount();

    render(<TripsPage />);

    await screen.findByText("Escapada a Roma");

    expect(tripsChain.select).toHaveBeenCalledWith("*");
    expect(tripsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tripsChain.order).toHaveBeenCalledWith("departure_date", {
      ascending: false,
    });
  });

  it("pinta el estado vacio cuando el usuario no tiene viajes", async () => {
    mount({ data: [], error: null });

    render(<TripsPage />);

    expect(
      await screen.findByText("No tienes viajes registrados"),
    ).toBeInTheDocument();
  });

  it("prioriza el estado vacío y oculta filtros y acción duplicada", async () => {
    mount({ data: [], error: null });

    render(<TripsPage />);

    await screen.findByText("No tienes viajes registrados");

    expect(screen.queryByRole("region", { name: "Filtros de viajes" })).not.toBeInTheDocument();
    expect(screen.queryByText("Nuevo viaje")).not.toBeInTheDocument();
    expect(screen.getByText("Crear primer viaje")).toBeInTheDocument();
  });

  it("distingue los filtros sin resultados y permite volver a ver los viajes", async () => {
    mount();

    render(<TripsPage />);
    expect(await screen.findByText("Escapada a Roma")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar viajes" }), {
      target: { value: "Tokio" },
    });

    expect(
      screen.getByText("No hay viajes que coincidan con tu búsqueda"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(screen.getByText("Escapada a Roma")).toBeInTheDocument();
  });

  it("no se traga el error del SDK y lo muestra al usuario", async () => {
    mount({ error: { message: "boom" } });

    render(<TripsPage />);

    expect(
      await screen.findByText(
        "Error al cargar los viajes. Por favor, intenta recargar.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pide iniciar sesion cuando no hay usuario y no consulta el SDK", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, loading: false });
    const { from } = mount();

    render(<TripsPage />);

    expect(
      await screen.findByText("Inicia sesión para ver tus viajes"),
    ).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
  });


  it("borra el viaje por el SDK tras confirmar en el dialogo y lo quita de la lista", async () => {
    mount();

    render(<TripsPage />);
    await screen.findByText("Escapada a Roma");

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar el viaje Escapada a Roma" }),
    );

    // El borrado ya no pasa por un window.confirm: se confirma en el dialogo.
    const confirmButton = await screen.findByRole("button", {
      name: "Eliminar viaje",
    });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(tripsChain.delete).toHaveBeenCalledTimes(1));
    expect(tripsChain.eq).toHaveBeenCalledWith("id", "trip-1");
    await waitFor(() =>
      expect(screen.queryByText("Escapada a Roma")).not.toBeInTheDocument(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no borra el viaje si se cancela el dialogo", async () => {
    mount();

    render(<TripsPage />);
    await screen.findByText("Escapada a Roma");

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar el viaje Escapada a Roma" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(tripsChain.delete).not.toHaveBeenCalled();
    expect(screen.getByText("Escapada a Roma")).toBeInTheDocument();
  });
});
