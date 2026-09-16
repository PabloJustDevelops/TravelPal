import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TasksPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Task } from "@/lib/insforge";

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

// El tablero y el modal no son lo que se migro: aislados, el test puede disparar
// a mano la edicion, el borrado, el cambio de estado y el guardado.
let mockModalPayload: Partial<Task> = {};
jest.mock("@/components/tasks/TaskBoard", () => {
  const Button = require("@/components/ui/Button").default;
  const MockBoard = ({
    tasks,
    onEditTask,
    onDeleteTask,
    onStatusChange,
  }: {
    tasks: Task[];
    onEditTask: (task: Task) => void;
    onDeleteTask: (task: Task) => void;
    onStatusChange: (taskId: string, status: Task["status"]) => void;
  }) => (
    <div>
      {tasks.map((task) => (
        <div key={task.id}>
          <span>{task.title}</span>
          <Button type="button" onClick={() => onEditTask(task)}>
            Editar {task.title}
          </Button>
          <Button type="button" onClick={() => onDeleteTask(task)}>
            Borrar {task.title}
          </Button>
          <Button
            type="button"
            onClick={() => onStatusChange(task.id, "completed")}
          >
            Completar {task.title}
          </Button>
        </div>
      ))}
    </div>
  );
  MockBoard.displayName = "TaskBoard";
  return { TaskBoard: MockBoard };
});

// El modal se aisla para poder entregarle al guardado una tarea sin `status`,
// `priority` ni `due_date`, que es justo el caso que el handler borrado cubria
// con sus valores por defecto.
jest.mock("@/components/tasks/TaskModal", () => {
  // El boton del sistema, para no anadir un boton HTML nativo nuevo (lo vigila
  // src/__tests__/design-system.test.ts).
  const Button = require("@/components/ui/Button").default;
  const MockModal = ({
    isOpen,
    initialData,
    onSave,
  }: {
    isOpen: boolean;
    initialData?: Task | null;
    onSave: (data: Partial<Task>) => void;
  }) =>
    isOpen ? (
      <div>
        <span>{initialData ? "Modo editar" : "Modo nueva"}</span>
        <Button type="button" onClick={() => void onSave(mockModalPayload)}>
          Guardar Tarea
        </Button>
      </div>
    ) : null;
  MockModal.displayName = "TaskModal";
  return { TaskModal: MockModal };
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
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cualquier terminal (order, single) resuelve
// el mismo resultado. Las escrituras reutilizan el resultado de lectura, que no
// trae error, para que no fallen.
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

const task: Task = {
  id: "t1",
  user_id: "user-123",
  title: "Reservar hotel en Roma",
  description: "Con cancelacion gratis",
  status: "pending",
  priority: "high",
  due_date: "2026-05-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const mockedClient = createInsforgeClient as jest.Mock;

let tasksChain: DbChain;
let fetchMock: jest.Mock;

function mount(result: QueryResult = { data: [task], error: null }) {
  tasksChain = makeChain(result);
  const from = jest.fn(() => tasksChain);
  mockedClient.mockReturnValue({ database: { from } });
  return { from };
}

describe("TasksPage con el SDK en el navegador", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModalPayload = {};
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

  it("lee las tareas del SDK y las pinta, sin tocar /api/tasks", async () => {
    const { from } = mount();

    render(<TasksPage />);

    expect(await screen.findByText("Reservar hotel en Roma")).toBeInTheDocument();

    // La lectura sale del SDK, tabla a tabla.
    expect(from).toHaveBeenCalledWith("tasks");
    // Y ni una llamada al BFF: el camino migratedo ya no pasa por fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pide el select, el filtro por usuario y el order del handler borrado", async () => {
    mount();

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    expect(tasksChain.select).toHaveBeenCalledWith("*");
    expect(tasksChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tasksChain.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("crea la tarea con los valores por defecto del handler cuando no vienen", async () => {
    mount();

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(screen.getByRole("button", { name: /nueva tarea/i }));
    mockModalPayload = {
      title: "Comprar adaptador",
      description: "Enchufe tipo L",
    };
    fireEvent.click(screen.getByText("Guardar Tarea"));

    await waitFor(() => {
      expect(tasksChain.insert).toHaveBeenCalledWith([
        {
          user_id: "user-123",
          title: "Comprar adaptador",
          description: "Enchufe tipo L",
          status: "pending",
          priority: "medium",
          due_date: null,
        },
      ]);
    });
    expect(tasksChain.select).toHaveBeenCalledWith();
    expect(tasksChain.single).toHaveBeenCalled();
  });

  it("respeta estado, prioridad y fecha cuando la tarea los trae", async () => {
    mount();

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(screen.getByRole("button", { name: /nueva tarea/i }));
    mockModalPayload = {
      title: "Cena con Marta",
      status: "in_progress",
      priority: "high",
      due_date: "2026-05-03T00:00:00.000Z",
    };
    fireEvent.click(screen.getByText("Guardar Tarea"));

    await waitFor(() => {
      expect(tasksChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          status: "in_progress",
          priority: "high",
          due_date: "2026-05-03T00:00:00.000Z",
        }),
      ]);
    });
  });

  it("edita con el update del handler, scopeado a id y user_id", async () => {
    mount();

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(
      screen.getByRole("button", { name: /editar reservar hotel en roma/i }),
    );
    expect(screen.getByText("Modo editar")).toBeInTheDocument();

    mockModalPayload = {
      title: "Reservar hotel en Roma",
      description: "Centrico",
    };
    fireEvent.click(screen.getByText("Guardar Tarea"));

    await waitFor(() => {
      expect(tasksChain.update).toHaveBeenCalledWith({
        title: "Reservar hotel en Roma",
        description: "Centrico",
      });
    });
    expect(tasksChain.eq).toHaveBeenCalledWith("id", "t1");
    expect(tasksChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cambia el estado con un update de status scopeado al usuario", async () => {
    mount();

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(
      screen.getByRole("button", { name: /completar reservar hotel en roma/i }),
    );

    await waitFor(() => {
      expect(tasksChain.update).toHaveBeenCalledWith({ status: "completed" });
    });
    expect(tasksChain.eq).toHaveBeenCalledWith("id", "t1");
    expect(tasksChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("borra con el delete del handler, scopeado a id y user_id", async () => {
    mount();

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(
      screen.getByRole("button", { name: /borrar reservar hotel en roma/i }),
    );

    await waitFor(() => {
      expect(tasksChain.delete).toHaveBeenCalled();
    });
    expect(tasksChain.eq).toHaveBeenCalledWith("id", "t1");
    expect(tasksChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no se traga el error del SDK y lo muestra al usuario", async () => {
    mount({ error: { message: "boom" } });

    render(<TasksPage />);

    expect(
      await screen.findByText("No se pudieron cargar las tareas."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
