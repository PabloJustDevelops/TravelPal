import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TasksPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, type Task } from "@/lib/insforge";
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
          <span data-testid={`status-${task.id}`}>{task.status}</span>
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
// trae error, para que no fallen... salvo que el test pase un `writeResult`
// aparte: asi se prueba el update/delete que no afecta a ninguna fila.
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
  chain.delete = jest.fn(() => {
    isWrite = true;
    return chain;
  });
  chain.single = jest.fn(() => chain);
  chain.then = (resolve) =>
    Promise.resolve(isWrite && writeResult ? writeResult : result).then(resolve);
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

function mount(
  result: QueryResult = { data: [task], error: null },
  writeResult?: QueryResult,
) {
  tasksChain = makeChain(result, writeResult);
  const from = jest.fn(() => tasksChain);
  mockedClient.mockReturnValue({ database: { from } });
  return { from };
}

const toastMock = showToast as jest.Mock;

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
    expect(tasksChain.select).toHaveBeenCalledWith();
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
    expect(tasksChain.select).toHaveBeenCalledWith();
    expect(tasksChain.eq).toHaveBeenCalledWith("id", "t1");
    expect(tasksChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(screen.getByTestId("status-t1")).toHaveTextContent("completed");
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
    expect(tasksChain.select).toHaveBeenCalledWith();
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

  // Con RLS, un update/delete sobre una fila ajena o inexistente no trae error:
  // la consulta vuelve con cero filas. El helper las trata como fallo, asi que
  // la UI no puede cantar exito.

  it("el update optimista de estado revierte si no afecta a ninguna fila", async () => {
    mount({ data: [task], error: null }, { data: [], error: null });

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");
    expect(screen.getByTestId("status-t1")).toHaveTextContent("pending");

    fireEvent.click(
      screen.getByRole("button", { name: /completar reservar hotel en roma/i }),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      );
    });
    // Cero filas: el estado local vuelve al previo, no se queda "completed".
    expect(screen.getByTestId("status-t1")).toHaveTextContent("pending");
    expect(tasksChain.select).toHaveBeenCalledWith();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it("un update sin filas afectadas avisa de error y no cierra el modal", async () => {
    mount({ data: [task], error: null }, { data: [], error: null });

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(
      screen.getByRole("button", { name: /editar reservar hotel en roma/i }),
    );
    mockModalPayload = { title: "Reservar hotel en Roma" };
    fireEvent.click(screen.getByText("Guardar Tarea"));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      );
    });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
    // El modal sigue abierto: no se ha tratado como exito.
    expect(screen.getByText("Modo editar")).toBeInTheDocument();
  });

  it("un delete sin filas afectadas avisa de error y no quita la tarea", async () => {
    mount({ data: [task], error: null }, { data: [], error: null });

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(
      screen.getByRole("button", { name: /borrar reservar hotel en roma/i }),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      );
    });
    expect(screen.getByText("Reservar hotel en Roma")).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it("con una fila afectada el update y el delete si confirman exito", async () => {
    mount();

    render(<TasksPage />);

    await screen.findByText("Reservar hotel en Roma");

    fireEvent.click(
      screen.getByRole("button", { name: /completar reservar hotel en roma/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("status-t1")).toHaveTextContent("completed");
    });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /borrar reservar hotel en roma/i }),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", message: "Tarea eliminada" }),
      );
    });
  });
});
