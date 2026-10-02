import { act, renderHook, waitFor } from "@testing-library/react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type AnyRecord = Record<string, unknown>;

interface Env {
  requestPermission: jest.Mock;
  subscribe: jest.Mock;
  getSubscription: jest.Mock;
  unsubscribe: jest.Mock;
  subscription: AnyRecord;
}

function makeSubscription(overrides: AnyRecord = {}): AnyRecord {
  return {
    toJSON: () => ({
      endpoint: "https://push.example/abc",
      expirationTime: null,
      keys: { p256dh: "p256dh-publica", auth: "auth-secreto" },
      ...overrides,
    }),
    unsubscribe: jest.fn().mockResolvedValue(true),
  };
}

function installEnv(permission: NotificationPermission = "granted"): Env {
  const subscription = makeSubscription();
  const subscribe = jest.fn().mockResolvedValue(subscription);
  const getSubscription = jest.fn().mockResolvedValue(null);
  const registration = { pushManager: { getSubscription, subscribe } };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: jest.fn().mockResolvedValue(registration),
      getRegistration: jest.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    },
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  });
  const requestPermission = jest.fn().mockResolvedValue("granted");
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission },
  });
  return {
    requestPermission,
    subscribe,
    getSubscription,
    unsubscribe: subscription.unsubscribe as jest.Mock,
    subscription,
  };
}

function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
  return store;
}

beforeEach(() => {
  installLocalStorage();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
    "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: undefined,
  });
  delete (window as unknown as AnyRecord).PushManager;
  delete (window as unknown as AnyRecord).Notification;
});

describe("usePushNotifications", () => {
  it("no pide permiso al montar: el permiso solo se pide con un gesto del usuario", async () => {
    const env = installEnv("default");

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.supported).toBe(true));
    expect(env.requestPermission).not.toHaveBeenCalled();
    expect(result.current.permission).toBe("default");
  });

  it("con permiso concedido, activar suscribe y deja el estado activo", async () => {
    const env = installEnv("default");

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(env.requestPermission).toHaveBeenCalledTimes(1);
    expect(env.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    await waitFor(() => expect(result.current.subscribed).toBe(true));
    expect(result.current.error).toBeNull();
    expect(window.localStorage.getItem("travelpal.push.subscription.v1")).not.toBeNull();
  });

  it("con permiso denegado no suscribe y lo deja en el error", async () => {
    const env = installEnv("default");
    env.requestPermission.mockResolvedValue("denied");

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(env.subscribe).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.subscribed).toBe(false);
  });

  it("si ya hay una suscripcion en el navegador la refleja sin volver a suscribir", async () => {
    const env = installEnv("granted");
    env.getSubscription.mockResolvedValue(env.subscription);

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.subscribed).toBe(true));
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(env.requestPermission).not.toHaveBeenCalled();
  });

  it("desactivar desuscribe en el navegador y limpia el puente", async () => {
    const env = installEnv("granted");
    env.getSubscription.mockResolvedValue(env.subscription);

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.subscribed).toBe(true));

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(env.unsubscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.subscribed).toBe(false));
    expect(window.localStorage.getItem("travelpal.push.subscription.v1")).toBeNull();
  });

  it("en un navegador sin soporte lo deja claro y no intenta nada", async () => {
    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.supported).toBe(false));
    expect(result.current.subscribed).toBe(false);
  });
});
