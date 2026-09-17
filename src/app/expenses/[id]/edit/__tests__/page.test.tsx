import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditExpensePage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createInsforgeClient, type Trip } from "@/lib/insforge";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
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
  update: jest.Mock;
  delete: jest.Mock;
  single: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
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

// `title` y `description` con valores distintos: asi el volcado al formulario
// delata si alguien invierte el mapeo.
const expense = {
  id: "e1",
  user_id: "user-123",
  trip_id: "trip-1",
  title: "Cena en Trastevere",
  description: "Mesa junto a la ventana",
  amount: 42.5,
  currency: "EUR",
  category: "food",
  date: "2026-05-02T20:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mockedClient = createInsforgeClient as jest.Mock;

describe("EditExpensePage con el SDK en el navegador", () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();
  let tripsChain: DbChain;
  let loadChain: DbChain;
  let writeChain: DbChain;
  let fetchMock: jest.Mock;

  // La lectura del gasto es la primera consulta a `expenses`; la escritura
  // (update o delete) es la siguiente, y necesita su propio resultado.
  function mount({
    tripsResult = { data: [trip], error: null },
    loadResult = { data: expense, error: null },
    writeResult = { data: [expense], error: null },
  }: {
    tripsResult?: QueryResult;
    loadResult?: QueryResult;
    writeResult?: QueryResult;
  } = {}) {
    tripsChain = makeChain(tripsResult);
    loadChain = makeChain(loadResult);
    writeChain = makeChain(writeResult);

    let expensesReads = 0;
    const from = jest.fn((table: string) => {
      if (table !== "expenses") return tripsChain;
      expensesReads += 1;
      return expensesReads === 1 ? loadChain : writeChain;
    });

    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lee el gasto del SDK con el select y los filtros del GET borrado, sin tocar /api/expenses", async () => {
    const { from } = mount();

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    expect(from).toHaveBeenCalledWith("expenses");
    expect(loadChain.select).toHaveBeenCalledWith("*");
    expect(loadChain.eq).toHaveBeenCalledWith("id", "e1");
    expect(loadChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(loadChain.single).toHaveBeenCalled();

    // El selector de viajes sigue leyendose del SDK, con su select y su order.
    expect(from).toHaveBeenCalledWith("trips");
    expect(tripsChain.select).toHaveBeenCalledWith("*");
    expect(tripsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tripsChain.order).toHaveBeenCalledWith("departure_date", {
      ascending: false,
    });

    // Ningun punto de la pantalla pasa ya por el BFF.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("vuelca la fila invirtiendo el mapeo: title a la descripcion y description a las notas", async () => {
    mount();

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    expect(
      screen.getByPlaceholderText(/Añade detalles adicionales sobre este gasto/i),
    ).toHaveValue("Mesa junto a la ventana");
  });

  it("actualiza por el SDK con el mapeo y el updated_at del PUT borrado", async () => {
    mount();

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    fireEvent.click(screen.getByText("Guardar Cambios"));

    await waitFor(() => {
      expect(writeChain.update).toHaveBeenCalled();
    });

    expect(writeChain.update).toHaveBeenCalledWith({
      title: "Cena en Trastevere",
      amount: 42.5,
      currency: "EUR",
      category: "food",
      date: "2026-05-02T20:00",
      trip_id: "trip-1",
      description: "Mesa junto a la ventana",
      updated_at: expect.any(String),
    });
    expect(writeChain.eq).toHaveBeenCalledWith("id", "e1");
    expect(writeChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(writeChain.select).toHaveBeenCalledWith();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/expenses");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fija el mapeo tambien al enviar: la descripcion del formulario va a title", async () => {
    mount();

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    fireEvent.change(screen.getByLabelText(/Descripción/i), {
      target: { value: "Cena en el Trastevere" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/Añade detalles adicionales sobre este gasto/i),
      { target: { value: "Con reserva" } },
    );

    fireEvent.click(screen.getByText("Guardar Cambios"));

    await waitFor(() => {
      expect(writeChain.update).toHaveBeenCalled();
    });

    const [payload] = writeChain.update.mock.calls[0];
    expect(payload.title).toBe("Cena en el Trastevere");
    expect(payload.description).toBe("Con reserva");
    expect(payload.title).not.toBe(payload.description);
  });

  it("borra el gasto por el SDK, con el id y el user_id del DELETE borrado", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);

    mount();

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    fireEvent.click(screen.getByText("Eliminar"));

    await waitFor(() => {
      expect(writeChain.delete).toHaveBeenCalled();
    });

    expect(writeChain.eq).toHaveBeenCalledWith("id", "e1");
    expect(writeChain.eq).toHaveBeenCalledWith("user_id", "user-123");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/expenses");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK al cargar y ofrece reintentar", async () => {
    mount({ loadResult: { data: null, error: { message: "boom" } } });

    render(<EditExpensePage />);

    expect(
      await screen.findByText("Error al cargar los datos del gasto"),
    ).toBeInTheDocument();
  });

  it("no se traga el error del SDK al actualizar y lo muestra", async () => {
    mount({ writeResult: { data: null, error: { message: "Database error" } } });

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    fireEvent.click(screen.getByText("Guardar Cambios"));

    await waitFor(() => {
      expect(screen.getByText("Database error")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("no bloquea el gasto si la lectura de viajes falla", async () => {
    mount({ tripsResult: { data: null, error: { message: "boom" } } });

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

  // Con RLS, un update/delete sobre un gasto ajeno o inexistente vuelve con
  // cero filas y sin error; el helper lo convierte en fallo.

  it("un update sin filas afectadas muestra el error y no navega", async () => {
    mount({ writeResult: { data: [], error: null } });

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    fireEvent.click(screen.getByText("Guardar Cambios"));

    expect(
      await screen.findByText(/No se pudo actualizar el gasto/),
    ).toBeInTheDocument();
    expect(writeChain.select).toHaveBeenCalledWith();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("un delete sin filas afectadas muestra el error y no navega", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);

    mount({ writeResult: { data: [], error: null } });

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    fireEvent.click(screen.getByText("Eliminar"));

    expect(
      await screen.findByText("Error al eliminar el gasto"),
    ).toBeInTheDocument();
    expect(writeChain.select).toHaveBeenCalledWith();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("abre un gasto huerfano (sin viaje) y lo puede reasignar a otro viaje", async () => {
    mount({ loadResult: { data: { ...expense, trip_id: null }, error: null } });

    render(<EditExpensePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Cena en Trastevere",
      );
    });

    // El gasto que dejo su viaje al borrarlo se sigue abriendo: el selector cae
    // en "Sin viaje asociado" en vez de romper.
    const select = document.querySelector(
      'select[name="trip_id"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(
      screen.getByRole("option", { name: "Sin viaje asociado" }),
    ).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "trip-1" } });
    fireEvent.click(screen.getByText("Guardar Cambios"));

    await waitFor(() => expect(writeChain.update).toHaveBeenCalled());
    expect(writeChain.update.mock.calls[0][0].trip_id).toBe("trip-1");
  });
});
