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
import {
  clearStoredSubscription,
  getExistingSubscription,
  getPushPermission,
  isPushSupported,
  loadStoredSubscription,
  PUSH_SUBSCRIPTION_STORAGE_KEY,
  saveStoredSubscription,
  serializeSubscription,
  subscribeToPush,
  syncPushSubscription,
  unsubscribeFromPush,
  urlBase64ToUint8Array,
} from "@/lib/push";

// Clave publica VAPID de ejemplo (la de los ejemplos de la Web Push API). No es
// un secreto: la publica va al cliente por diseno.
const VAPID_PUBLIC_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

type AnyRecord = Record<string, unknown>;

interface Env {
  requestPermission: jest.Mock;
  subscribe: jest.Mock;
  getSubscription: jest.Mock;
  register: jest.Mock;
  getRegistration: jest.Mock;
  unsubscribe: jest.Mock;
  subscription: AnyRecord;
  registration: AnyRecord;
}

function makeSubscription(overrides: AnyRecord = {}): AnyRecord {
  const json = {
    endpoint: "https://push.example/abc",
    expirationTime: null,
    keys: { p256dh: "p256dh-publica", auth: "auth-secreto" },
    ...overrides,
  };
  return { toJSON: () => json, unsubscribe: jest.fn().mockResolvedValue(true) };
}

// Instala un navegador con Service Worker, PushManager y Notification. Devuelve
// los espías para poder afirmar que el flujo llama (o no) a cada API.
function installEnv(permission: NotificationPermission = "default"): Env {
  const subscription = makeSubscription();
  const getSubscription = jest.fn().mockResolvedValue(null);
  const subscribe = jest.fn().mockResolvedValue(subscription);
  const unsubscribe = subscription.unsubscribe as jest.Mock;
  const registration: AnyRecord = {
    pushManager: { getSubscription, subscribe },
  };
  const register = jest.fn().mockResolvedValue(registration);
  const getRegistration = jest.fn().mockResolvedValue(registration);
  const requestPermission = jest.fn().mockResolvedValue("granted");

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, getRegistration, ready: Promise.resolve(registration) },
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission },
  });

  return {
    requestPermission,
    subscribe,
    getSubscription,
    register,
    getRegistration,
    unsubscribe,
    subscription,
    registration,
  };
}

// localStorage con memoria real: el mock global no guarda y aqui se prueba que
// el caché persiste de verdad.
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
  jest.mocked(createInsforgeClient).mockReturnValue(
    { auth: { getCurrentUser }, database: { from } } as unknown as ReturnType<
      typeof createInsforgeClient
    >,
  );
  getCurrentUser.mockResolvedValue({ data: { user: { id: "session-owner" } }, error: null });
  upsert.mockResolvedValue({ error: null });
  deleteResult = { error: null };
  installLocalStorage();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: undefined,
  });
  delete (window as unknown as AnyRecord).PushManager;
  delete (window as unknown as AnyRecord).Notification;
});

describe("urlBase64ToUint8Array", () => {
  it("decodifica base64url con el mismo resultado que el decodificador estandar", () => {
    const result = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const expected = new Uint8Array(Buffer.from(VAPID_PUBLIC_KEY, "base64url"));

    expect(Array.from(result)).toEqual(Array.from(expected));
  });

  it("anade el relleno que falte para una longitud no multiplo de 4", () => {
    // "QQ" es base64url sin relleno de "A" (0x41).
    expect(Array.from(urlBase64ToUint8Array("QQ"))).toEqual([65]);
  });
});

describe("deteccion de soporte y permiso", () => {
  it("sin Service Worker ni PushManager el navegador no soporta push", () => {
    expect(isPushSupported()).toBe(false);
  });

  it("con Service Worker, PushManager y Notification si soporta push", () => {
    installEnv();

    expect(isPushSupported()).toBe(true);
  });

  it("devuelve el permiso que declara Notification", () => {
    installEnv("denied");

    expect(getPushPermission()).toBe("denied");
  });
});

describe("persistencia del caché en localStorage", () => {
  it("guarda y recupera la suscripcion serializada", () => {
    const stored = {
      endpoint: "https://push.example/abc",
      keys: { p256dh: "p", auth: "a" },
      expirationTime: null,
    };

    saveStoredSubscription(stored);

    expect(window.localStorage.getItem(PUSH_SUBSCRIPTION_STORAGE_KEY)).toBe(
      JSON.stringify(stored),
    );
    expect(loadStoredSubscription()).toEqual(stored);
  });

  it("devuelve null ante un valor corrupto, sin lanzar", () => {
    window.localStorage.setItem(PUSH_SUBSCRIPTION_STORAGE_KEY, "{no es json");

    expect(loadStoredSubscription()).toBeNull();
  });

  it("borra la entrada guardada", () => {
    saveStoredSubscription({
      endpoint: "https://push.example/abc",
      keys: { p256dh: "p", auth: "a" },
      expirationTime: null,
    });

    clearStoredSubscription();

    expect(loadStoredSubscription()).toBeNull();
  });
});

describe("serializeSubscription", () => {
  it("extrae endpoint y claves de la suscripcion del navegador", () => {
    const serialized = serializeSubscription(
      makeSubscription() as unknown as PushSubscription,
    );

    expect(serialized).toEqual({
      endpoint: "https://push.example/abc",
      keys: { p256dh: "p256dh-publica", auth: "auth-secreto" },
      expirationTime: null,
    });
  });
});

describe("subscribeToPush", () => {
  it("pide permiso solo si esta sin decidir y guarda la suscripcion", async () => {
    const env = installEnv("default");

    const serialized = await subscribeToPush(VAPID_PUBLIC_KEY);

    expect(env.requestPermission).toHaveBeenCalledTimes(1);
    expect(env.subscribe).toHaveBeenCalledTimes(1);
    expect(env.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(serialized.endpoint).toBe("https://push.example/abc");
    expect(loadStoredSubscription()).toEqual(serialized);
  });

  it("no vuelve a preguntar si el permiso ya estaba concedido", async () => {
    const env = installEnv("granted");

    await subscribeToPush(VAPID_PUBLIC_KEY);

    expect(env.requestPermission).not.toHaveBeenCalled();
    expect(env.subscribe).toHaveBeenCalledTimes(1);
  });

  it("reutiliza la suscripcion existente en lugar de crear otra", async () => {
    const env = installEnv("granted");
    const existing = makeSubscription({ endpoint: "https://push.example/ya" });
    env.getSubscription.mockResolvedValue(existing);

    const serialized = await subscribeToPush(VAPID_PUBLIC_KEY);

    expect(env.subscribe).not.toHaveBeenCalled();
    expect(serialized.endpoint).toBe("https://push.example/ya");
  });

  it("si el usuario deniega el permiso no suscribe y avisa", async () => {
    const env = installEnv("default");
    env.requestPermission.mockResolvedValue("denied");

    await expect(subscribeToPush(VAPID_PUBLIC_KEY)).rejects.toThrow(/permiso/i);
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(loadStoredSubscription()).toBeNull();
  });

  it("sin clave publica VAPID no suscribe: el push no se puede firmar", async () => {
    const env = installEnv("granted");

    await expect(subscribeToPush("")).rejects.toThrow(/VAPID/i);
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it("en un navegador sin soporte no intenta suscribir y avisa", async () => {
    await expect(subscribeToPush(VAPID_PUBLIC_KEY)).rejects.toThrow(
      /no soporta/i,
    );
  });
});

describe("getExistingSubscription", () => {
  it("devuelve la suscripcion ya registrada en el navegador", async () => {
    const env = installEnv("granted");
    const existing = makeSubscription();
    env.getSubscription.mockResolvedValue(existing);

    await expect(getExistingSubscription()).resolves.toBe(existing);
  });

  it("devuelve null si no hay service worker registrado", async () => {
    installEnv("granted");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: jest.fn().mockResolvedValue(undefined) },
    });

    await expect(getExistingSubscription()).resolves.toBeNull();
  });
});

describe("unsubscribeFromPush", () => {
  it("desuscribe en el navegador y limpia el caché", async () => {
    const env = installEnv("granted");
    env.getSubscription.mockResolvedValue(env.subscription);
    saveStoredSubscription({
      endpoint: "https://push.example/abc",
      keys: { p256dh: "p", auth: "a" },
      expirationTime: null,
    });

    await expect(unsubscribeFromPush()).resolves.toBe(true);

    expect(env.unsubscribe).toHaveBeenCalledTimes(1);
    expect(loadStoredSubscription()).toBeNull();
  });

  it("sin suscripcion activa no llama al navegador pero limpia el caché", async () => {
    const env = installEnv("granted");
    env.getSubscription.mockResolvedValue(null);

    await expect(unsubscribeFromPush()).resolves.toBe(false);
    expect(env.unsubscribe).not.toHaveBeenCalled();
  });
});

it("persiste el alta con la identidad de sesión, claves y last_seen_at actualizado", async () => {
  installEnv("granted");
  await subscribeToPush(VAPID_PUBLIC_KEY);
  expect(getCurrentUser).toHaveBeenCalled();
  expect(from).toHaveBeenCalledWith("push_subscriptions");
  expect(upsert).toHaveBeenCalledWith([expect.objectContaining({
    user_id: "session-owner",
    endpoint: "https://push.example/abc",
    p256dh: "p256dh-publica",
    auth: "auth-secreto",
    user_agent: navigator.userAgent,
    last_seen_at: expect.any(String),
  })], { onConflict: "endpoint" });
});

it("repite el upsert por endpoint sin duplicar el alta del navegador y refresca last_seen_at", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  jest.useFakeTimers().setSystemTime(new Date("2026-10-23T12:00:00Z"));
  try {
    await subscribeToPush(VAPID_PUBLIC_KEY);
    jest.setSystemTime(new Date("2026-10-23T13:00:00Z"));
    await subscribeToPush(VAPID_PUBLIC_KEY);
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(upsert.mock.calls.map(([rows]) => rows[0].last_seen_at)).toEqual([
      "2026-10-23T12:00:00.000Z",
      "2026-10-23T13:00:00.000Z",
    ]);
    expect(upsert.mock.calls.every(([, options]) => options.onConflict === "endpoint")).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

it("sin sesión verificada no escribe ninguna fila", async () => {
  installEnv("granted");
  getCurrentUser.mockResolvedValue({ data: null, error: null });
  await expect(subscribeToPush(VAPID_PUBLIC_KEY)).rejects.toThrow(/sesión/i);
  expect(upsert).not.toHaveBeenCalled();
});

it("borra por endpoint y propietario aunque no exista la fila", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  await expect(unsubscribeFromPush()).resolves.toBe(true);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", "https://push.example/abc");
  expect(deleteQuery.eq).toHaveBeenCalledWith("user_id", "session-owner");
});

it("un error al borrar conserva la suscripción para que pueda reintentarse", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  deleteResult = { error: { message: "database unavailable" } };
  await expect(unsubscribeFromPush()).rejects.toThrow();
  expect(env.unsubscribe).not.toHaveBeenCalled();
});

it("un endpoint de otra cuenta se renueva sin modificar la fila ajena", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  const replacement = makeSubscription({ endpoint: "https://push.example/new-account" });
  env.subscribe.mockResolvedValue(replacement);
  upsert.mockResolvedValueOnce({ error: { code: "42501" } }).mockResolvedValue({ error: null });
  const serialized = await subscribeToPush(VAPID_PUBLIC_KEY);
  expect(env.unsubscribe).toHaveBeenCalledTimes(1);
  expect(env.subscribe).toHaveBeenCalledTimes(1);
  expect(serialized.endpoint).toBe("https://push.example/new-account");
  expect(upsert).toHaveBeenLastCalledWith([
    expect.objectContaining({ endpoint: serialized.endpoint, user_id: "session-owner" }),
  ], { onConflict: "endpoint" });
  expect(remove).not.toHaveBeenCalled();
});

it("reconcilia repetidamente una fila borrada sin pedir permiso ni crear otra suscripción", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  await syncPushSubscription();
  await syncPushSubscription();
  expect(upsert).toHaveBeenCalledTimes(2);
  expect(env.requestPermission).not.toHaveBeenCalled();
  expect(env.subscribe).not.toHaveBeenCalled();
});

it("limpia la fila de la caché aunque el navegador ya no tenga la suscripción", async () => {
  installEnv("granted");
  saveStoredSubscription({
    endpoint: "https://push.example/stale",
    keys: { p256dh: "p", auth: "a" },
    expirationTime: null,
  });
  await expect(unsubscribeFromPush()).resolves.toBe(false);
  expect(deleteQuery.eq).toHaveBeenCalledWith("endpoint", "https://push.example/stale");
  expect(loadStoredSubscription()).toBeNull();
});

it("serializa reconciliación y baja para no reinsertar un endpoint desactivado", async () => {
  const env = installEnv("granted");
  env.getSubscription.mockResolvedValue(env.subscription);
  let finishUpsert!: (value: { error: null }) => void;
  let started!: () => void;
  const writing = new Promise<{ error: null }>((resolve) => {
    finishUpsert = resolve;
  });
  const upsertStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  upsert.mockImplementationOnce(() => {
    started();
    return writing;
  });
  const sync = syncPushSubscription();
  await upsertStarted;
  const unsubscribe = unsubscribeFromPush();
  await Promise.resolve();
  expect(remove).not.toHaveBeenCalled();
  finishUpsert({ error: null });
  await sync;
  await unsubscribe;
  expect(remove).toHaveBeenCalledTimes(1);
  expect(env.unsubscribe).toHaveBeenCalledTimes(1);
  expect(loadStoredSubscription()).toBeNull();
});
