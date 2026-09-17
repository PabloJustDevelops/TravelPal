import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewBookingForm from "../NewBookingForm";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Booking } from "@/lib/insforge";
import { logger } from "@/lib/logger";

// Mock dependencies
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
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

// Cadena encadenable y "awaitable": cualquier terminal (order, single) resuelve
// el mismo resultado. La lectura de viajes del selector y la escritura de la
// reserva comparten cadena, asi que un resultado con error prueba las dos.
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

const mockedClient = createInsforgeClient as jest.Mock;

const existingBooking: Booking = {
  id: "b1",
  user_id: "test-user-id",
  trip_id: "trip-1",
  type: "hotel",
  title: "Hotel en Paris",
  status: "confirmed",
  start_date: "2025-04-01",
  start_time: "15:00",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("NewBookingForm", () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();
  let chain: DbChain;
  let fetchMock: jest.Mock;

  const mount = (
    result: QueryResult = {
      data: [{ id: 'trip-1', title: 'Trip to Paris' }],
      error: null,
    },
  ) => {
    chain = makeChain(result);
    const from = jest.fn(() => chain);
    mockedClient.mockReturnValue({ database: { from } });
    return { from };
  };

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'test-user-id' },
    })

    mount()
    // El formulario migrado no debe tocar el BFF: cualquier fetch seria un fallo.
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it("lee los viajes del selector por el SDK, sin tocar /api/trips", async () => {
    const { from } = mount()

    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    )

    expect(
      await screen.findByRole('option', { name: 'Trip to Paris' }),
    ).toBeInTheDocument()

    // El selector sale del SDK, con el mismo select, filtro y order del handler.
    expect(from).toHaveBeenCalledWith('trips')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'test-user-id')
    expect(chain.order).toHaveBeenCalledWith('departure_date', {
      ascending: false,
    })
    // Nada de fetch al cargar: el camino migrado no pasa por el BFF.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("deja el selector sin opciones si el SDK falla, sin romper el formulario", async () => {
    mount({ data: null, error: { message: 'boom' } })

    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    )

    // El error de los viajes no bloquea la reserva (mismo contrato que antes):
    // el formulario se pinta y el selector queda solo con el placeholder.
    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching trips for selector',
        expect.anything(),
      )
    })
    expect(screen.getByLabelText(/Título/i)).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Trip to Paris' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renders correctly", async () => {
    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );
    expect(screen.getByLabelText(/Título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha/i)).toBeInTheDocument();

    // Espera a que el selector de viajes cargue para evitar updates sin act
    expect(
      await screen.findByRole('option', { name: 'Trip to Paris' }),
    ).toBeInTheDocument();
  });

  it("da de alta la reserva por el SDK con los campos y defaults del handler", async () => {
    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    // El trip_id se preselecciona con el primer viaje cargado
    await screen.findByRole('option', { name: 'Trip to Paris' });

    fireEvent.change(screen.getByLabelText(/Título/i), {
      target: { value: "Test Booking" },
    });
    fireEvent.change(screen.getByLabelText(/Nº Personas/i), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/Fecha/i), {
      target: { value: "2025-05-01" },
    });

    fireEvent.click(screen.getByText("Guardar Reserva"));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    // El insert reproduce el POST borrado: `user_id` lo ponia la API, el numero
    // de personas viaja dentro de `notes` y los opcionales vacios caen a null
    // (`cost` a 0 y `currency` a EUR).
    expect(chain.insert).toHaveBeenCalledWith([
      {
        user_id: "test-user-id",
        trip_id: "trip-1",
        type: "other",
        title: "Test Booking",
        description: null,
        start_date: "2025-05-01",
        start_time: "12:00",
        end_date: null,
        end_time: null,
        location: null,
        confirmation_number: null,
        airline: null,
        flight_number: null,
        origin: null,
        destination: null,
        cost: 0,
        currency: "EUR",
        status: "confirmed",
        notes: "Personas: 2\n",
      },
    ]);
    expect(chain.select).toHaveBeenCalledWith();
    expect(chain.single).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("da de alta una reserva de tipo actividad con los mismos campos", async () => {
    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    await screen.findByRole('option', { name: 'Trip to Paris' });

    fireEvent.change(screen.getByLabelText(/Título/i), {
      target: { value: "Cena en Roma" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo/i), {
      target: { value: "activity" },
    });
    fireEvent.change(screen.getByLabelText(/Fecha/i), {
      target: { value: "2025-06-01" },
    });

    fireEvent.click(screen.getByText("Guardar Reserva"));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "activity",
        title: "Cena en Roma",
        start_date: "2025-06-01",
        airline: null,
        cost: 0,
        currency: "EUR",
      }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("edita la reserva con el update del handler, scopeado a id y user_id", async () => {
    render(
      <NewBookingForm
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
        initialData={existingBooking}
      />,
    );

    const submitButton = screen.getByText("Guardar Reserva");
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    // El update reproduce el PUT borrado: mismos campos con sus defaults, el
    // `updated_at` explicito y el scope por id y usuario. Ni `trip_id` ni
    // `user_id` viajan en el payload.
    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload).toEqual({
      type: "hotel",
      title: "Hotel en Paris",
      description: null,
      start_date: "2025-04-01",
      start_time: "15:00",
      end_date: null,
      end_time: null,
      location: null,
      confirmation_number: null,
      airline: null,
      flight_number: null,
      origin: null,
      destination: null,
      cost: 0,
      currency: "EUR",
      status: "confirmed",
      notes: "Personas: 1\n",
      updated_at: expect.any(String),
    });
    expect(updatePayload).not.toHaveProperty("trip_id");
    expect(updatePayload).not.toHaveProperty("user_id");
    expect(chain.eq).toHaveBeenCalledWith("id", "b1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "test-user-id");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles cancellation", async () => {
    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );
    await screen.findByRole('option', { name: 'Trip to Paris' });
    fireEvent.click(screen.getByText("Cancelar"));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  const selectFlightType = () => {
    fireEvent.change(screen.getByLabelText(/Tipo/i), {
      target: { value: "flight" },
    });
  };

  it("muestra los campos de vuelo solo cuando el tipo es Vuelo", async () => {
    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );
    await screen.findByRole('option', { name: 'Trip to Paris' });

    expect(screen.queryByLabelText(/Nº de vuelo/i)).not.toBeInTheDocument();

    selectFlightType();

    expect(screen.getByLabelText(/Aerolínea/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nº de vuelo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Origen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Destino/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Precio/i)).toBeInTheDocument();
  });

  it("envia los datos del vuelo cuando el tipo es Vuelo", async () => {
    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );
    await screen.findByRole('option', { name: 'Trip to Paris' });

    fireEvent.change(screen.getByLabelText(/Título/i), {
      target: { value: "Vuelo a Nueva York" },
    });
    fireEvent.change(screen.getByLabelText(/Fecha/i), {
      target: { value: "2025-05-01" },
    });

    selectFlightType();
    fireEvent.change(screen.getByLabelText(/Aerolínea/i), {
      target: { value: "Iberia" },
    });
    fireEvent.change(screen.getByLabelText(/Nº de vuelo/i), {
      target: { value: "IB3201" },
    });
    fireEvent.change(screen.getByLabelText(/Origen/i), {
      target: { value: "MAD" },
    });
    fireEvent.change(screen.getByLabelText(/Destino/i), {
      target: { value: "JFK" },
    });
    fireEvent.change(screen.getByLabelText(/Precio/i), {
      target: { value: "123.45" },
    });

    fireEvent.click(screen.getByText("Guardar Reserva"));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "flight",
        title: "Vuelo a Nueva York",
        airline: "Iberia",
        flight_number: "IB3201",
        origin: "MAD",
        destination: "JFK",
        cost: 123.45,
        currency: "EUR",
      }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no envia datos de vuelo si el tipo no es Vuelo", async () => {
    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );
    await screen.findByRole('option', { name: 'Trip to Paris' });

    fireEvent.change(screen.getByLabelText(/Título/i), {
      target: { value: "Hotel en Paris" },
    });
    fireEvent.change(screen.getByLabelText(/Fecha/i), {
      target: { value: "2025-05-01" },
    });

    fireEvent.click(screen.getByText("Guardar Reserva"));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    // Los campos de vuelo del handler caen a null y `cost` a 0.
    const payload = chain.insert.mock.calls[0][0][0];
    expect(payload.airline).toBeNull();
    expect(payload.flight_number).toBeNull();
    expect(payload.origin).toBeNull();
    expect(payload.destination).toBeNull();
    expect(payload.cost).toBe(0);
    expect(payload.currency).toBe("EUR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK al guardar la reserva", async () => {
    mount({ data: null, error: { message: 'boom' } })

    render(
      <NewBookingForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    const submitButton = screen.getByText("Guardar Reserva");
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);

    expect(
      await screen.findByText(/Error al guardar la reserva/),
    ).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
