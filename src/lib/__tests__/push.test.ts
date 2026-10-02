import {
  PUSH_SUBSCRIPTION_STORAGE_KEY,
  clearStoredSubscription,
  getExistingSubscription,
  getPushPermission,
  isPushSupported,
  loadStoredSubscription,
  saveStoredSubscription,
  serializeSubscription,
  subscribeToPush,
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
// el puente persiste de verdad.
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

describe("persistencia del puente en localStorage", () => {
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
  it("desuscribe en el navegador y limpia el puente", async () => {
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

  it("sin suscripcion activa no llama al navegador pero limpia el puente", async () => {
    const env = installEnv("granted");
    env.getSubscription.mockResolvedValue(null);

    await expect(unsubscribeFromPush()).resolves.toBe(false);
    expect(env.unsubscribe).not.toHaveBeenCalled();
  });
});
