import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import NotesPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Note } from "@/lib/insforge";
import { showToast } from "@/lib/toast";

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
jest.mock("@/lib/toast", () => ({ showToast: jest.fn() }));

// El formulario no es lo que se migro: al aislarlo se le puede entregar al
// guardado una nota sin `category` ni `trip_id`, que es justo el caso que el
// handler borrado cubria con sus valores por defecto.
let mockEditorPayload: Partial<Note> = {};
jest.mock("@/components/notes/NoteEditor", () => {
  // El boton del sistema, para no anadir un boton HTML nativo nuevo (lo vigila
  // src/__tests__/design-system.test.ts).
  const Button = require("@/components/ui/Button").default;
  const MockEditor = ({
    onSave,
  }: {
    onSave: (note: Partial<Note>) => Promise<void>;
  }) => (
    <Button type="button" onClick={() => void onSave(mockEditorPayload)}>
      Guardar Nota
    </Button>
  );
  MockEditor.displayName = "NoteEditor";
  return MockEditor;
});

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  single: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cualquier terminal (order, single) resuelve
// el mismo resultado. El insert reutiliza el resultado de lectura, que no trae
// error, para que la creacion no falle. El update puede recibir un
// `writeResult` aparte para probar el caso de cero filas afectadas.
function makeChain(result: QueryResult, writeResult?: QueryResult): DbChain {
  const chain = {} as DbChain;
  let isWrite = false;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.insert = jest.fn(() => {
    isWrite = true;
    return chain;
  });
  chain.update = jest.fn(() => {
    isWrite = true;
    return chain;
  });
  chain.single = jest.fn(() => chain);
  chain.then = (resolve) =>
    Promise.resolve(isWrite && writeResult ? writeResult : result).then(resolve);
  return chain;
}

// Copiado literal del select del handler borrado (main:src/app/api/notes/route.ts).
const TRIPS_SELECT =
  "id, title, user_id, origin, destination, departure_date, return_date, status, created_at, updated_at";

const note = {
  id: "n1",
  user_id: "user-123",
  trip_id: "trip-1",
  title: "Notas de Roma",
  content: "Contenido de la nota",
  tags: [],
  category: "general",
  is_favorite: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  trip: { title: "Escapada a Roma" },
};

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

const mockedClient = createInsforgeClient as jest.Mock;

let notesChain: DbChain;
let tripsChain: DbChain;
let fetchMock: jest.Mock;

function mount({
  notesResult = { data: [note], error: null },
  tripsResult = { data: [trip], error: null },
  notesWriteResult,
}: {
  notesResult?: QueryResult;
  tripsResult?: QueryResult;
  notesWriteResult?: QueryResult;
} = {}) {
  notesChain = makeChain(notesResult, notesWriteResult);
  tripsChain = makeChain(tripsResult);
  const from = jest.fn((table: string) =>
    table === "notes" ? notesChain : tripsChain,
  );
  mockedClient.mockReturnValue({ database: { from } });
  return { from };
}

async function openEditorAndSave() {
  fireEvent.click(screen.getByText("Nueva Nota"));
  fireEvent.click(screen.getByText("Guardar Nota"));
}

// Abre el editor sobre la nota existente (no la creacion) y guarda.
async function openExistingAndSave() {
  const card = screen.getByText("Notas de Roma").closest(".group");
  fireEvent.click(within(card as HTMLElement).getByRole("button"));
  fireEvent.click(screen.getByText("Guardar Nota"));
}

const toastMock = showToast as jest.Mock;

describe("NotesPage con el SDK en el navegador", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEditorPayload = {};
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

  it("lee las notas y los viajes del SDK y las pinta, sin tocar /api/notes", async () => {
    const { from } = mount();

    render(<NotesPage />);

    expect(await screen.findByText("Notas de Roma")).toBeInTheDocument();

    // Las dos consultas salen del SDK, tabla a tabla.
    expect(from).toHaveBeenCalledWith("notes");
    expect(from).toHaveBeenCalledWith("trips");
    // Y ni una llamada al BFF: el camino migratedo ya no pasa por fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pide el select de notas con el viaje embebido y las columnas de viajes del handler", async () => {
    mount();

    render(<NotesPage />);

    await screen.findByText("Notas de Roma");

    expect(notesChain.select).toHaveBeenCalledWith("*, trip:trips(*)");
    expect(tripsChain.select).toHaveBeenCalledWith(TRIPS_SELECT);
  });

  it("crea la nota con los valores por defecto del handler cuando no vienen", async () => {
    mount();

    render(<NotesPage />);

    await screen.findByText("Notas de Roma");

    mockEditorPayload = { title: "Nueva nota", content: "Cuerpo de la nota" };
    await openEditorAndSave();

    await waitFor(() => {
      expect(notesChain.insert).toHaveBeenCalledWith([
        {
          user_id: "user-123",
          title: "Nueva nota",
          content: "Cuerpo de la nota",
          category: "general",
          trip_id: null,
          is_favorite: false,
        },
      ]);
    });
  });

  it("respeta la categoria y el viaje cuando la nota los trae", async () => {
    mount();

    render(<NotesPage />);

    await screen.findByText("Notas de Roma");

    mockEditorPayload = {
      title: "Con viaje",
      content: "Cuerpo",
      category: "itinerary",
      trip_id: "trip-1",
    };
    await openEditorAndSave();

    await waitFor(() => {
      expect(notesChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          category: "itinerary",
          trip_id: "trip-1",
        }),
      ]);
    });
  });

  it("no se traga el error del SDK y lo muestra al usuario", async () => {
    mount({ notesResult: { error: { message: "boom" } } });

    render(<NotesPage />);

    expect(
      await screen.findByText(
        "Error al cargar las notas. Por favor, inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();
  });

  // Con RLS, un update sobre una nota ajena o inexistente vuelve con cero
  // filas y sin error; el helper lo convierte en fallo para que no se cante
  // un exito que no ha ocurrido.

  it("el update sin filas afectadas avisa de error y no cierra el editor", async () => {
    mount({ notesWriteResult: { data: [], error: null } });

    render(<NotesPage />);

    await screen.findByText("Notas de Roma");

    mockEditorPayload = { title: "Notas de Roma", content: "Actualizado" };
    await openExistingAndSave();

    await waitFor(() => {
      expect(notesChain.update).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      );
    });
    expect(notesChain.select).toHaveBeenCalledWith();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
    // El editor sigue abierto: no se ha tratado como exito.
    expect(screen.getByText("Guardar Nota")).toBeInTheDocument();
  });

  it("con una fila afectada el update guarda sin error", async () => {
    mount();

    render(<NotesPage />);

    await screen.findByText("Notas de Roma");

    mockEditorPayload = { title: "Notas de Roma", content: "Actualizado" };
    await openExistingAndSave();

    await waitFor(() => {
      expect(notesChain.update).toHaveBeenCalled();
    });
    expect(notesChain.select).toHaveBeenCalledWith();
    expect(toastMock).not.toHaveBeenCalled();
  });
});
