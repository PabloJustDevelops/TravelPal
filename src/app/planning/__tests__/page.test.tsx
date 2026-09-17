import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import PlanningPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Booking } from "@/lib/insforge";
import { QueryTimeoutError } from "@/lib/insforge-query";
import { CONNECTION_TIMEOUT_MESSAGE } from "@/lib/utils";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/planning",
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

interface CalendarEventLike {
  id: string;
  title: string;
  activityId?: string;
  [key: string]: unknown;
}

interface CalendarPropsLike {
  events: CalendarEventLike[];
  onDeleteEvent: (event: CalendarEventLike) => void;
  onEventDrop: (event: CalendarEventLike, date: Date) => void;
  onAddEvent: (date: Date) => void;
}

// El calendario no es lo que se migro: se aisla y expone sus handlers como
// botones del sistema para poder disparar el borrado y el movimiento de una
// actividad a mano.
jest.mock("@/components/calendar/Calendar", () => {
  const Button = require("@/components/ui/Button").default;
  const MockCalendar = ({
    events,
    onDeleteEvent,
    onEventDrop,
    onAddEvent,
  }: CalendarPropsLike) => (
    <div>
      <Button type="button" onClick={() => onAddEvent(new Date(2026, 4, 3))}>
        Anadir evento
      </Button>
      {events.map((event) => (
        <div key={event.id}>
          <span>{event.title}</span>
          <Button type="button" onClick={() => onDeleteEvent(event)}>
            Borrar {event.title}
          </Button>
          <Button
            type="button"
            onClick={() => onEventDrop(event, new Date(2026, 4, 9))}
          >
            Mover {event.title}
          </Button>
        </div>
      ))}
    </div>
  );
  MockCalendar.displayName = "Calendar";
  return { Calendar: MockCalendar };
});

// El modal y el formulario de reserva se aislan: el formulario ya tiene sus
// propias pruebas, aqui solo se comprueba el cableado de la pagina.
jest.mock("@/components/ui/Modal", () => {
  const MockModal = ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null);
  MockModal.displayName = "Modal";
  return { __esModule: true, default: MockModal };
});

jest.mock("@/components/planning/NewBookingForm", () => {
  const Button = require("@/components/ui/Button").default;
  const MockNewBookingForm = ({ onSuccess }: { onSuccess: () => void }) => (
    <Button type="button" onClick={onSuccess}>
      Reserva guardada
    </Button>
  );
  MockNewBookingForm.displayName = "NewBookingForm";
  return { __esModule: true, default: MockNewBookingForm };
});

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  single: jest.Mock;
  then: (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cualquier terminal (order, eq, single)
// resuelve el resultado de la lectura, que es lo que espera el `await` del
// componente. Las escrituras reutilizan ese mismo resultado, sin error.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  chain.single = jest.fn(() => chain);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const booking: Booking = {
  id: "b1",
  user_id: "user-123",
  trip_id: "trip-1",
  type: "flight",
  title: "Vuelo a Roma",
  status: "confirmed",
  start_date: "2026-05-01",
  start_time: "10:00",
  cost: 120,
  currency: "EUR",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const trip = {
  id: "trip-1",
  user_id: "user-123",
  title: "Escapada a Roma",
  destination: "Roma",
  departure_date: "2026-05-01",
  return_date: "2026-05-07",
  status: "confirmed",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const activity = {
  id: "a1",
  user_id: "user-123",
  trip_id: "trip-1",
  title: "Cena en Trastevere",
  date: "2026-05-02",
  start_time: "20:00",
  category: "food",
  completed: false,
  order_index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mockedClient = createInsforgeClient as jest.Mock;

describe("PlanningPage con el SDK en el navegador", () => {
  let tripsChain: DbChain;
  let bookingsChain: DbChain;
  let activitiesChain: DbChain;
  let fetchMock: jest.Mock;

  // Las tres lecturas del GET borrado llegan del SDK, tabla a tabla: ya no hay
  // ningun fetch en la pagina.
  function mount({
    tripsResult = { data: [trip], error: null },
    bookingsResult = { data: [booking], error: null },
    activitiesResult = { data: [activity], error: null },
    activitiesWriteError,
  }: {
    tripsResult?: QueryResult;
    bookingsResult?: QueryResult;
    activitiesResult?: QueryResult;
    activitiesWriteError?: unknown;
  } = {}) {
    tripsChain = makeChain(tripsResult);
    bookingsChain = makeChain(bookingsResult);
    activitiesChain = makeChain(activitiesResult);

    // La lectura resuelve con `activitiesResult`; a partir de la segunda
    // suscripcion (la escritura del planificador) la cadena falla con el error
    // indicado. Es la unica forma de distinguir lectura y escritura sobre la
    // misma tabla sin cambiar el resto del arnes.
    if (activitiesWriteError !== undefined) {
      let thenCalls = 0;
      activitiesChain.then = (resolve, reject) => {
        thenCalls += 1;
        if (thenCalls === 1) {
          return Promise.resolve(activitiesResult).then(resolve, reject);
        }
        return Promise.reject(activitiesWriteError).then(resolve, reject);
      };
    }

    const from = jest.fn((table: string) => {
      if (table === "trips") return tripsChain;
      if (table === "bookings") return bookingsChain;
      return activitiesChain;
    });
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  }

  // El planificador es real: se entra a su vista desde el calendario, se
  // despliega un dia y se opera con el modal o con los botones de la fila.
  async function openItineraryPlanner() {
    render(<PlanningPage />);
    expect(
      await screen.findByText("Planificación de Viajes"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Itinerario"));
    fireEvent.click(await screen.findByText("Escapada a Roma"));
    await screen.findByText("Planificador de Itinerario");
  }

  function submitActivity(title: string, label: string) {
    const titleInput = screen.getByPlaceholderText("Nombre de la actividad");
    fireEvent.change(titleInput, { target: { value: title } });
    const form = titleInput.closest("form") as HTMLFormElement;
    fireEvent.click(within(form).getByText(label));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user-123" },
      loading: false,
    });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lee viajes, reservas y actividades del SDK y los pinta, sin tocar /api/planning", async () => {
    const { from } = mount();

    render(<PlanningPage />);

    expect(await screen.findByText("Planificación de Viajes")).toBeInTheDocument();

    // Las tres lecturas salen del SDK, tabla a tabla.
    expect(from).toHaveBeenCalledWith("trips");
    expect(from).toHaveBeenCalledWith("bookings");
    expect(from).toHaveBeenCalledWith("itinerary_activities");
    expect(await screen.findByText("Cena en Trastevere")).toBeInTheDocument();

    // Y ni una llamada al BFF: el camino migrado ya no pasa por fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pide el select, el filtro por usuario y el order de las tres consultas", async () => {
    mount();

    render(<PlanningPage />);

    await screen.findByText("Planificación de Viajes");

    // Viajes: `*`, filtro por usuario y salida ascendente.
    expect(tripsChain.select).toHaveBeenCalledWith("*");
    expect(tripsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tripsChain.order).toHaveBeenCalledWith("departure_date", {
      ascending: true,
    });

    // Reservas: `*`, filtro por usuario e inicio ascendente.
    expect(bookingsChain.select).toHaveBeenCalledWith("*");
    expect(bookingsChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(bookingsChain.order).toHaveBeenCalledWith("start_date", {
      ascending: true,
    });

    // Actividades: `*` y filtro por usuario, sin order en el handler.
    expect(activitiesChain.select).toHaveBeenCalledWith("*");
    expect(activitiesChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(activitiesChain.order).not.toHaveBeenCalled();
  });

  it("borra una actividad por el SDK y recarga", async () => {
    mount();

    render(<PlanningPage />);

    await screen.findByText("Planificación de Viajes");

    fireEvent.click(
      await screen.findByText("Borrar Cena en Trastevere"),
    );

    await waitFor(() => {
      expect(activitiesChain.delete).toHaveBeenCalled();
    });
    expect(activitiesChain.eq).toHaveBeenCalledWith("id", "a1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mueve una actividad de fecha por el SDK con el update del calendario", async () => {
    mount();

    render(<PlanningPage />);

    await screen.findByText("Planificación de Viajes");

    fireEvent.click(await screen.findByText("Mover Cena en Trastevere"));

    await waitFor(() => {
      expect(activitiesChain.update).toHaveBeenCalledWith({
        date: "2026-05-09",
      });
    });
    expect(activitiesChain.eq).toHaveBeenCalledWith("id", "a1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recarga la planificacion al cerrar el alta de reserva", async () => {
    mount();

    render(<PlanningPage />);

    await screen.findByText("Planificación de Viajes");

    fireEvent.click(screen.getByText("Anadir evento"));
    fireEvent.click(screen.getByText("Reserva guardada"));

    // `handleBookingCreated` vuelve a leer las tres tablas del SDK.
    await waitFor(() => {
      expect(tripsChain.select).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK y ofrece reintentar por el SDK", async () => {
    mount({ tripsResult: { data: null, error: { message: "boom" } } });

    render(<PlanningPage />);

    expect(
      await screen.findByText(
        "Error al cargar la planificación. Por favor, inténtalo de nuevo.",
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

    render(<PlanningPage />);

    expect(await screen.findByText("Planificación de Viajes")).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("da de alta una actividad del planificador por el SDK y recarga", async () => {
    mount();
    await openItineraryPlanner();

    // Dia 1 (2026-05-01) vacio: la clave del dia es ISO y casa con el mapeo.
    fireEvent.click(screen.getByText(/Día 1/));
    fireEvent.click(screen.getByText("Agregar primera actividad"));

    submitActivity("Tour por el Coliseo", "Agregar");

    await waitFor(() => {
      expect(activitiesChain.insert).toHaveBeenCalled();
    });

    // El alta llena la fila con el usuario, el viaje y la fecha del dia, y
    // reproduce los campos del modal (moneda por defecto EUR, como el esquema).
    expect(activitiesChain.insert).toHaveBeenCalledWith([
      {
        user_id: "user-123",
        trip_id: "trip-1",
        date: "2026-05-01",
        title: "Tour por el Coliseo",
        description: null,
        start_time: "09:00",
        end_time: "10:00",
        location: null,
        category: "activity",
        cost: null,
        currency: "EUR",
        notes: null,
        completed: false,
        order_index: 0,
      },
    ]);
    expect(activitiesChain.select).toHaveBeenCalledWith();

    // El refetch recarga las tres tablas: la fuente de verdad es el servidor.
    await waitFor(() => {
      expect(tripsChain.select).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("edita una actividad por el SDK con el id persistido", async () => {
    mount();
    await openItineraryPlanner();

    fireEvent.click(screen.getByText(/Día 2/));
    fireEvent.click(
      screen.getByRole("button", { name: "Editar Cena en Trastevere" }),
    );

    submitActivity("Cena en Testaccio", "Actualizar");

    await waitFor(() => {
      expect(activitiesChain.update).toHaveBeenCalled();
    });

    expect(activitiesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Cena en Testaccio",
        start_time: "20:00",
        category: "food",
      }),
    );
    // El id que viaja es el uuid de la fila, nunca uno sintetico.
    expect(activitiesChain.eq).toHaveBeenCalledWith("id", "a1");
    expect(activitiesChain.eq).not.toHaveBeenCalledWith(
      "id",
      expect.stringMatching(/^activity_/),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("borra una actividad por el SDK con el id persistido y recarga", async () => {
    mount();
    await openItineraryPlanner();

    fireEvent.click(screen.getByText(/Día 2/));
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Cena en Trastevere" }),
    );

    await waitFor(() => {
      expect(activitiesChain.delete).toHaveBeenCalled();
    });

    expect(activitiesChain.eq).toHaveBeenCalledWith("id", "a1");
    expect(activitiesChain.eq).not.toHaveBeenCalledWith(
      "id",
      expect.stringMatching(/^activity_/),
    );
    expect(activitiesChain.select).toHaveBeenCalledWith();

    // Nada de borrado local: se recarga desde el servidor.
    await waitFor(() => {
      expect(tripsChain.select).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no canta exito ni recarga si el alta no afecta a ninguna fila", async () => {
    mount({ activitiesResult: { data: [], error: null } });
    await openItineraryPlanner();

    fireEvent.click(screen.getByText(/Día 1/));
    fireEvent.click(screen.getByText("Agregar primera actividad"));

    submitActivity("Tour por el Coliseo", "Agregar");

    expect(
      await screen.findByText(/Error al guardar la actividad/),
    ).toBeInTheDocument();
    // Cero filas afectadas es un fallo: no hay refetch ni exito.
    expect(tripsChain.select).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("avisa del timeout cuando el guardado no responde", async () => {
    // La cadena de la escritura rechaza con el error que lanza
    // `withQueryTimeout` al vencer; el temporizador real esta cubierto en
    // src/lib/__tests__/insforge-query.test.ts.
    mount({ activitiesWriteError: new QueryTimeoutError("tarde") });
    await openItineraryPlanner();

    fireEvent.click(screen.getByText(/Día 1/));
    fireEvent.click(screen.getByText("Agregar primera actividad"));

    submitActivity("Tour por el Coliseo", "Agregar");

    expect(
      await screen.findByText(CONNECTION_TIMEOUT_MESSAGE),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
