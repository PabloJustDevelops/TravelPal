import PushSubscriptionSync from "@/components/common/PushSubscriptionSync";
import { useAuth } from "@/contexts/AuthContext";
jest.mock(
  "@/contexts/AuthContext",
  () => ({ useAuth: jest.fn(() => ({ user: { id: "ui-user" }, loading: false })) }),
);
import { createInsforgeClient } from "@/lib/insforge";
jest.mock("@/lib/insforge", () => ({ createInsforgeClient: jest.fn() }));
const getCurrentUser = jest.fn();
const upsert = jest.fn();
const deleteQuery = {
  eq: jest.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(deleteResult).then(resolve),
};
let deleteResult: { error: unknown } = { error: null };
const remove = jest.fn(() => deleteQuery);
const from = jest.fn(() => ({ upsert, delete: remove }));
import { act, render, renderHook, waitFor } from "@testing-library/react";
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
  subscribe.mockImplementation(async () => {
    getSubscription.mockResolvedValue(subscription);
    return subscription;
  });
  (subscription.unsubscribe as jest.Mock).mockImplementation(async () => {
    getSubscription.mockResolvedValue(null);
    return true;
  });
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
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(
    { user: { id: "ui-user" }, loading: false } as ReturnType<typeof useAuth>,
  );
  jest.mocked(createInsforgeClient).mockReturnValue(
    { auth: { getCurrentUser }, database: { from } } as unknown as ReturnType<
      typeof createInsforgeClient
    >,
  );
  getCurrentUser.mockResolvedValue({ data: { user: { id: "session-owner" } }, error: null });
  upsert.mockResolvedValue({ error: null });
  deleteResult = { error: null };
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

  it("desactivar desuscribe en el navegador y limpia el caché", async () => {
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

it("reconcilia una suscripción viva mediante upsert con el usuario del SDK", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  render(<PushSubscriptionSync />);
  await waitFor(() =>
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: "session-owner", endpoint: "https://push.example/abc" }),
    ], { onConflict: "endpoint" })
  );
  expect(env.requestPermission).not.toHaveBeenCalled();
  expect(env.subscribe).not.toHaveBeenCalled();
});

it("un error de reconciliación conserva el interruptor activo y muestra el fallo", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  upsert.mockResolvedValue({ error: { message: "offline" } });
  const { result } = renderHook(() => usePushNotifications());
  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.subscribed).toBe(true);
  expect(result.current.busy).toBe(false);
});

it("un error de borrado mantiene el interruptor activo y permite reintentar", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  const { result } = renderHook(() => usePushNotifications());
  await waitFor(() => expect(result.current.subscribed).toBe(true));
  deleteResult = { error: { message: "offline" } };
  await act(async () => {
    await result.current.unsubscribe();
  });
  expect(result.current.subscribed).toBe(true);
  expect(result.current.busy).toBe(false);
  expect(result.current.error).not.toBeNull();
});

it("si falla el SDK tras crear el alta, refleja la suscripción real y deja reintentar", async () => {
  installEnv("granted");
  upsert.mockRejectedValue(new Error("network down"));
  const { result } = renderHook(() => usePushNotifications());
  await waitFor(() => expect(result.current.busy).toBe(false));
  await act(async () => {
    await result.current.subscribe();
  });
  expect(result.current.subscribed).toBe(true);
  expect(result.current.busy).toBe(false);
  expect(result.current.error).not.toBeNull();
});

it("reconcilia al cambiar de cuenta y obtiene la identidad nueva del SDK", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  const { result, rerender } = renderHook(() => usePushNotifications());
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(upsert).toHaveBeenCalled();
  getCurrentUser.mockResolvedValue({ data: { user: { id: "new-session-owner" } }, error: null });
  jest.mocked(useAuth).mockReturnValue(
    { user: { id: "new-ui-user" }, loading: false } as ReturnType<typeof useAuth>,
  );
  rerender();
  await waitFor(() =>
    expect(upsert).toHaveBeenLastCalledWith([
      expect.objectContaining({ user_id: "new-session-owner" }),
    ], { onConflict: "endpoint" })
  );
});
