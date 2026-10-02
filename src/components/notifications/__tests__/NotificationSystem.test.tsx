import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationSystem } from "../NotificationSystem";
import { createInsforgeClient } from "@/lib/insforge";
import { deriveAlerts } from "@/lib/alerts";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import type { Task } from "@/lib/insforge";

// El objeto `user` debe ser estable entre renders: si cambia de referencia en cada
// render, el efecto que carga alertas se vuelve a disparar en bucle.
jest.mock("@/contexts/AuthContext", () => {
  const user = { id: "user-a" };
  return { useAuth: () => ({ user, loading: false }) };
});
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
// logger.error dispara un toast, pero aqui el logger esta mockeado: se mockea el
// toast aparte para poder afirmar que una cancelacion no llega a mostrarlo.
jest.mock("@/lib/toast", () => ({ showToast: jest.fn() }));

type Row = Record<string, unknown>;
type TableName = "alerts" | "tasks" | "bookings" | "budgets" | "expenses";

interface Tables {
  alerts?: Row[];
  tasks?: Row[];
  bookings?: Row[];
  budgets?: Row[];
  expenses?: Row[];
}

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface Chain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  abortSignal: jest.Mock;
  insert: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cliente InsForge minimo: reproduce el encadenado select/eq/order/abortSignal/insert
// y devuelve por tabla las filas preparadas por cada test. Las inserciones se
// acumulan para poder afirmar que se guardaron (o no).
function makeClient(tables: Tables, errors: Partial<Record<TableName, unknown>> = {}) {
  const inserted: Row[][] = [];

  const makeChain = (table: TableName) => {
    let columns = "";
    let pendingInsert: Row[] | null = null;

    const api: Chain = {
      select: jest.fn((cols: string) => {
        columns = cols;
        return api;
      }),
      eq: jest.fn(() => api),
      order: jest.fn(() => api),
      abortSignal: jest.fn(() => api),
      insert: jest.fn((rows: Row[]) => {
        pendingInsert = rows;
        return api;
      }),
      then: (resolve: (value: QueryResult) => unknown) => {
        const rowsForTable = tables[table] ?? [];

        if (pendingInsert) {
          const rows = pendingInsert;
          inserted.push(rows);
          // Las filas insertadas pasan a existir para la recarga posterior.
          tables[table] = [
            ...rowsForTable,
            ...rows.map((row, index) => ({ id: `inserted-${table}-${index}`, ...row })),
          ];
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }

        if (errors[table]) {
          return Promise.resolve({ data: null, error: errors[table] }).then(
            resolve,
          );
        }

        if (table === "alerts") {
          // La deduplicacion lee todas las alertas (title, message); la campana
          // lee solo las no leidas.
          if (columns !== "*") {
            return Promise.resolve({
              data: rowsForTable.map((row) => ({
                title: row.title,
                message: row.message,
              })),
              error: null,
            }).then(resolve);
          }
          return Promise.resolve({
            data: rowsForTable.filter((row) => row.is_read === false),
            error: null,
          }).then(resolve);
        }

        return Promise.resolve({ data: rowsForTable, error: null }).then(resolve);
      },
    };

    return api;
  };

  const from = jest.fn((table: string) => makeChain(table as TableName));
  return {
    client: { database: { from } },
    inserted,
  };
}

const mockedCreate = createInsforgeClient as jest.Mock;

function alertRow(overrides: Row = {}): Row {
  return {
    id: "a1",
    title: "Alerta existente",
    message: "Mensaje de la alerta",
    type: "info",
    is_read: false,
    alert_date: "2026-05-01T00:00:00.000Z",
    created_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function dueSoonTask(overrides: Partial<Task> = {}): Task {
  // Vence en 2 dias respecto al reloj real del test, dentro de la ventana.
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return {
    id: "t1",
    user_id: "user-a",
    title: "Preparar maleta",
    status: "pending",
    priority: "medium",
    due_date: date,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

// Forma EXACTA que tendria el AbortError una vez envuelto por withQueryTimeout y
// el SDK: un objeto plano (NO instanceof Error) con `code: "20"` y el texto
// "AbortError" en message/details. El bug depende de esta forma: el criterio
// anterior solo miraba Error/DOMException y por eso lo trataba como fallo real.
function abortQueryError(): Row {
  return {
    message: "AbortError: signal is aborted without reason",
    details:
      "AbortError: signal is aborted without reason\n    at commitHookPassiveUnmountEffects (react-dom-client.development.js:1:1)\n    at recursivelyTraversePassiveUnmountEffects (react-dom-client.development.js:2:2)",
    hint: "",
    code: "20",
  };
}

function mount(tables: Tables, errors: Partial<Record<TableName, unknown>> = {}) {
  const { client, inserted } = makeClient(tables, errors);
  mockedCreate.mockReturnValue(client);
  return { inserted };
}

async function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /notificaciones/i }));
}

describe("NotificationSystem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("muestra las alertas no leidas que ya existian", async () => {
    mount({ alerts: [alertRow()] });

    render(<NotificationSystem />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /1 sin leer/i }),
      ).toBeInTheDocument();
    });

    await openPanel();

    expect(await screen.findByText("Alerta existente")).toBeInTheDocument();
  });

  it("deriva e inserta una alerta a partir de una tarea por vencer", async () => {
    const task = dueSoonTask();
    const { inserted } = mount({ tasks: [task as unknown as Row] });

    render(<NotificationSystem />);

    await waitFor(() => {
      expect(inserted).toHaveLength(1);
    });

    expect(inserted[0][0]).toEqual(
      expect.objectContaining({
        user_id: "user-a",
        type: "reminder",
        is_read: false,
      }),
    );
    expect(String(inserted[0][0].title)).toContain("Preparar maleta");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /1 sin leer/i }),
      ).toBeInTheDocument();
    });

    await openPanel();
    expect(
      await screen.findByText(/Tarea por vencer: Preparar maleta/),
    ).toBeInTheDocument();
  });

  it("no reinserta una alerta que ya existe aunque este leida", async () => {
    const task = dueSoonTask();
    const [derived] = deriveAlerts({
      tasks: [task],
      bookings: [],
      budgets: [],
      expenses: [],
    });

    const { inserted } = mount({
      tasks: [task as unknown as Row],
      alerts: [
        alertRow({
          title: derived.title,
          message: derived.message,
          type: "reminder",
          is_read: true,
        }),
      ],
    });

    render(<NotificationSystem />);

    await openPanel();

    // La alerta existe (leida), asi que el panel esta vacio por diseno...
    await waitFor(() => {
      expect(screen.getByText("No hay notificaciones")).toBeInTheDocument();
    });

    // ...y no se ha insertado ninguna fila nueva.
    expect(inserted).toHaveLength(0);
  });

  it("si el enriquecimiento falla la campana sigue mostrando lo existente", async () => {
    mount(
      { alerts: [alertRow()] },
      { tasks: { message: "sin acceso a tasks" } },
    );

    render(<NotificationSystem />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /1 sin leer/i }),
      ).toBeInTheDocument();
    });

    await openPanel();

    expect(await screen.findByText("Alerta existente")).toBeInTheDocument();
  });

  it("una carga abortada no registra error ni muestra un toast", async () => {
    // El AbortController del propio componente cancela el enriquecimiento al
    // desmontarse; la consulta rechaza con la forma envuelta, no con un Error.
    mount({ alerts: [alertRow()] }, { tasks: abortQueryError() });

    render(<NotificationSystem />);

    // La campana termina de cargar con lo que ya habia...
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /1 sin leer/i }),
      ).toBeInTheDocument();
    });

    // ...y la cancelacion NO se registra ni dispara el toast rojo.
    expect(logger.error).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("un fallo real del enriquecimiento se registra y no rompe la campana", async () => {
    mount(
      { alerts: [alertRow()] },
      { tasks: { message: "sin acceso a tasks" } },
    );

    render(<NotificationSystem />);

    // Un error que NO es cancelacion sigue registrandose como antes...
    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        "NotificationSystem: Error deriving alerts",
        expect.anything(),
      );
    });

    // ...y no lanza: la campana sigue mostrando lo que ya habia.
    await openPanel();
    expect(await screen.findByText("Alerta existente")).toBeInTheDocument();
  });

  it("una cancelacion durante el enriquecimiento no oculta lo que ya habia", async () => {
    mount({ alerts: [alertRow()] }, { tasks: abortQueryError() });

    render(<NotificationSystem />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /1 sin leer/i }),
      ).toBeInTheDocument();
    });

    // Salir en silencio no puede llevarse por delante las alertas ya leidas.
    await openPanel();
    expect(await screen.findByText("Alerta existente")).toBeInTheDocument();
  });
});
