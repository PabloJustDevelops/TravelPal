import { readFileSync } from "node:fs";
import path from "node:path";

// El service worker de `public/` no es un modulo: es un script que corre en su
// propio ambito global (`self`). Para probarlo sin navegador se evalua el
// fichero real con un `self` de mentira y se despachan los eventos que el
// worker registra. Asi la prueba cubre el codigo de verdad que se despliega.
const SW_SOURCE = readFileSync(
  path.join(process.cwd(), "public", "sw.js"),
  "utf8",
);

interface FakeClient {
  url: string;
  focus: jest.Mock;
}

interface WorkerHarness {
  listeners: Record<string, (event: unknown) => void>;
  showNotification: jest.Mock;
  openWindow: jest.Mock;
  matchAll: jest.Mock;
}

function loadWorker(clients: FakeClient[] = []): WorkerHarness {
  const listeners: Record<string, (event: unknown) => void> = {};
  const showNotification = jest.fn().mockResolvedValue(undefined);
  const openWindow = jest.fn().mockResolvedValue(undefined);
  const matchAll = jest.fn().mockResolvedValue(clients);

  const fakeSelf = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = handler;
    },
    registration: { showNotification },
    location: { origin: "https://app.example" },
    clients: { matchAll, openWindow },
  };

  const run = new Function("self", SW_SOURCE);
  run(fakeSelf);

  return { listeners, showNotification, openWindow, matchAll };
}

// Ejecuta el handler y espera el `waitUntil` que haya programado.
async function dispatch(
  handler: (event: unknown) => void,
  event: Record<string, unknown>,
) {
  let pending: Promise<unknown> | undefined;
  handler({ ...event, waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
  if (pending) await pending;
}

describe("service worker de push", () => {
  it("registra los manejadores de push y de click en la notificacion", () => {
    const { listeners } = loadWorker();

    expect(typeof listeners.push).toBe("function");
    expect(typeof listeners.notificationclick).toBe("function");
  });

  it("muestra la notificacion con el titulo, el cuerpo y la url del aviso", async () => {
    const { listeners, showNotification } = loadWorker();

    await dispatch(listeners.push, {
      data: {
        json: () => ({ title: "Reserva proxima", body: "Empieza manana", url: "/trips/42" }),
      },
    });

    expect(showNotification).toHaveBeenCalledWith("Reserva proxima", {
      body: "Empieza manana",
      data: { url: "/trips/42" },
    });
  });

  it("sin payload muestra un aviso generico que abre el dashboard", async () => {
    const { listeners, showNotification } = loadWorker();

    await dispatch(listeners.push, { data: null });

    expect(showNotification).toHaveBeenCalledWith("TravelPal", {
      body: "",
      data: { url: "/dashboard" },
    });
  });

  it("ante un payload ilegible no lanza y cae al aviso generico", async () => {
    const { listeners, showNotification } = loadWorker();

    await dispatch(listeners.push, {
      data: {
        json: () => {
          throw new Error("payload no es json");
        },
      },
    });

    expect(showNotification).toHaveBeenCalledWith("TravelPal", {
      body: "",
      data: { url: "/dashboard" },
    });
  });

  it("al pulsar, cierra la notificacion y abre la url absoluta del aviso", async () => {
    const { listeners, openWindow } = loadWorker();

    const notification = { close: jest.fn(), data: { url: "/trips/42" } };
    await dispatch(listeners.notificationclick, { notification });

    expect(notification.close).toHaveBeenCalledTimes(1);
    expect(openWindow).toHaveBeenCalledWith("https://app.example/trips/42");
  });

  it("si ya hay una pestana con esa url la enfoca en vez de abrir otra", async () => {
    const client = { url: "https://app.example/trips/42", focus: jest.fn() };
    const { listeners, openWindow } = loadWorker([client]);

    const notification = { close: jest.fn(), data: { url: "/trips/42" } };
    await dispatch(listeners.notificationclick, { notification });

    expect(client.focus).toHaveBeenCalledTimes(1);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("una notificacion sin url abre el dashboard", async () => {
    const { listeners, openWindow } = loadWorker();

    const notification = { close: jest.fn(), data: undefined };
    await dispatch(listeners.notificationclick, { notification });

    expect(openWindow).toHaveBeenCalledWith("https://app.example/dashboard");
  });
});
