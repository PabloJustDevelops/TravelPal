import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import NewTripPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createInsforgeClient } from "@/lib/insforge";
import { logger } from "@/lib/logger";

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
  usePathname: () => "/create-trip",
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
  let tripsChain: DbChain;
  let budgetsChain: DbChain;
  let fetchMock: jest.Mock;

  // El viaje y su presupuesto inicial salen del SDK, tabla a tabla: ya no hay
  // ningun fetch en la pagina.
  const mount = ({
    tripsResult = { data: { id: "new-trip-id" }, error: null },
    budgetsResult = { data: { id: "budget-1" }, error: null },
  }: {
    tripsResult?: QueryResult;
    budgetsResult?: QueryResult;
  } = {}) => {
    tripsChain = makeChain(tripsResult);
    budgetsChain = makeChain(budgetsResult);
    const from = jest.fn((table: string) =>
      table === "budgets" ? budgetsChain : tripsChain,
    );
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "test-user-id" } });
    // La pagina migrada no debe tocar el BFF: cualquier fetch seria un fallo.
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("expone controles de estado y notas con etiquetas accesibles", () => {
    mount();

    render(<NewTripPage />);

    expect(screen.getByLabelText("Estado del viaje")).toHaveValue("planned");
    expect(screen.getByLabelText("Notas adicionales")).toBeInTheDocument();
  });

  it("prefill datos de inspiración y no crea el viaje hasta el envío explícito", async () => {
    mount();
    window.history.replaceState(
      {},
      "",
      "/create-trip?source=inspiration&origin=MAD&destination=LON&departure=2026-11-12&return=2026-11-19",
    );

    render(<NewTripPage />);

    await waitFor(() => expect(screen.getByLabelText(/Título del Viaje/i)).toHaveValue("Viaje a LON"));
    expect(screen.getByLabelText(/Origen/i)).toHaveValue("MAD");
    expect(screen.getByRole("textbox", { name: "Destino *" })).toHaveValue("LON");
    expect(screen.getByLabelText(/Fecha de Salida/i)).toHaveValue("2026-11-12T09:00");
    expect(screen.getByLabelText(/Fecha de Regreso/i)).toHaveValue("2026-11-19T09:00");
    expect(tripsChain.insert).not.toHaveBeenCalled();
  });

  it("ignora parámetros de inspiración malformados", async () => {
    mount();
    window.history.replaceState(
      {},
      "",
      "/create-trip?source=inspiration&origin=bad&destination=LON&departure=ayer&return=2026-11-19",
    );

    render(<NewTripPage />);

    await waitFor(() => expect(screen.getByLabelText(/Título del Viaje/i)).toHaveValue(""));
    expect(screen.getByLabelText(/Origen/i)).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Destino *" })).toHaveValue("");
    expect(screen.getByLabelText(/Fecha de Salida/i)).toHaveValue("");
    expect(tripsChain.insert).not.toHaveBeenCalled();
  });

  it("mantiene los datos de vuelo opcionales plegados hasta que se solicitan", () => {
    mount();

    render(<NewTripPage />);

    const summary = screen.getByText("Añadir datos de vuelo (opcional)");
    const disclosure = summary.closest("details");

    expect(disclosure).not.toBeNull();
    expect(disclosure).toHaveProperty("open", false);
    fireEvent.click(summary);
    expect(disclosure).toHaveProperty("open", true);
    expect(screen.getByLabelText("Aerolínea")).toBeInTheDocument();
    expect(screen.getByLabelText("Número de Vuelo")).toBeInTheDocument();
  });

  it("actualiza el resumen mientras se completan los campos", () => {
    mount();

    render(<NewTripPage />);

    fireEvent.change(screen.getByLabelText(/Título del Viaje/i), {
      target: { value: "Lisboa, a tu ritmo" },
    });
    fireEvent.change(screen.getByLabelText(/Origen/i), {
      target: { value: "Madrid" },
    });
    fireEvent.change(screen.getByLabelText("Destino *"), {
      target: { value: "Lisboa" },
    });
    fireEvent.change(screen.getByLabelText(/Número de Personas/i), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/Presupuesto Estimado/i), {
      target: { value: "900" },
    });

    const summary = screen.getByRole("complementary", { name: "Resumen del viaje" });
    expect(within(summary).getByRole("heading", { name: "Así empieza tu viaje" })).toBeInTheDocument();
    expect(within(summary).getByText("Lisboa, a tu ritmo")).toBeInTheDocument();
    const route = summary.querySelector("dd");
    expect(route).toHaveTextContent("Madrid → Lisboa");
    expect(within(summary).getByText("2 personas")).toBeInTheDocument();
    expect(within(summary).getByText(/900,00/)).toBeInTheDocument();
  });

  function fillRequiredFields() {
    fireEvent.change(screen.getByLabelText(/Título del Viaje/i), {
      target: { value: "Test Trip" },
    });
    fireEvent.change(screen.getByLabelText(/Origen/i), {
      target: { value: "Madrid" },
    });
    fireEvent.change(screen.getByLabelText("Destino *"), {
      target: { value: "Paris" },
    });
    fireEvent.change(screen.getByLabelText(/Fecha de Salida/i), {
      target: { value: "2025-01-01T10:00" },
    });
  }

  it("crea el viaje y el presupuesto inicial por el SDK y navega al detalle", async () => {
    const { from } = mount();

    render(<NewTripPage />);

    fillRequiredFields();
    fireEvent.click(screen.getByText("Añadir datos de vuelo (opcional)"));
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
      expect(mockPush).toHaveBeenCalledWith("/trip?id=new-trip-id");
    });

    // El alta reproduce el objeto de insercion del handler borrado: el user_id
    // lo ponia la API, y los opcionales vacios caian a null.
    expect(tripsChain.insert).toHaveBeenCalledWith([
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
    expect(tripsChain.select).toHaveBeenCalledWith();
    expect(tripsChain.single).toHaveBeenCalled();

    // El presupuesto inicial tambien va por el SDK, con el objeto del POST
    // borrado: mismas fechas recortadas a dia, EUR fijo y `description` a null.
    expect(from).toHaveBeenCalledWith("budgets");
    expect(budgetsChain.insert).toHaveBeenCalledWith([
      {
        user_id: "test-user-id",
        name: "Presupuesto General",
        total_amount: 1000,
        currency: "EUR",
        category: "General",
        start_date: "2025-01-01",
        end_date: "2025-01-01",
        trip_id: "new-trip-id",
        description: null,
      },
    ]);
    expect(budgetsChain.select).toHaveBeenCalledWith();
    expect(budgetsChain.single).toHaveBeenCalled();

    // Y ni una llamada al BFF.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no crea el presupuesto cuando el presupuesto estimado es 0", async () => {
    const { from } = mount();

    render(<NewTripPage />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Presupuesto Estimado/i), {
      target: { value: "0" },
    });

    fireEvent.click(screen.getByText("Crear Viaje"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/trip?id=new-trip-id");
    });

    expect(tripsChain.insert).toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith("budgets");
    expect(budgetsChain.insert).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK y no navega", async () => {
    mount({ tripsResult: { data: null, error: { message: "Database error occurred" } } });

    render(<NewTripPage />);

    fillRequiredFields();
    fireEvent.click(screen.getByText("Crear Viaje"));

    await waitFor(() => {
      expect(screen.getByText("Database error occurred")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(budgetsChain.insert).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mantiene el viaje y navega aunque falle el presupuesto inicial", async () => {
    mount({ budgetsResult: { data: null, error: { message: "budget boom" } } });

    render(<NewTripPage />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/Presupuesto Estimado/i), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByText("Crear Viaje"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/trip?id=new-trip-id");
    });

    // El fallo del presupuesto no impide el alta del viaje ni la navegacion:
    // solo queda registrado como aviso.
    expect(tripsChain.insert).toHaveBeenCalled();
    expect(budgetsChain.insert).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Error al crear presupuesto inicial:",
      { message: "budget boom" },
    );
    expect(screen.queryByText("budget boom")).not.toBeInTheDocument();
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
    expect(tripsChain.insert).not.toHaveBeenCalled();
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
    expect(tripsChain.insert).not.toHaveBeenCalled();
  });
});
