/**
 * Capa de navegador de las notificaciones push de TravelPal.
 *
 * Solo toca APIs del navegador (Service Worker, PushManager, Notification) y el
 * puente de localStorage. NO firma ni envia nada: la firma VAPID y el envio son
 * de servidor y hoy estan bloqueados (ver ADR-013). La suscripcion serializada
 * que devuelve `subscribeToPush` es exactamente la fila que guardara la futura
 * tabla `push_subscriptions`; localStorage es un puente temporal, no la fuente
 * de verdad (esa es `pushManager.getSubscription()`).
 */

export const PUSH_SUBSCRIPTION_STORAGE_KEY = "travelpal.push.subscription.v1";
export const PUSH_SERVICE_WORKER_URL = "/sw.js";

export type PushPermissionState = NotificationPermission;

export interface SerializedPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime: number | null;
}

/** Clave publica VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`). Sin ella no hay push. */
export function getVapidPublicKey(): string | undefined {
  // Acceso estatico a propósito: el bundler solo sustituye `process.env.NEXT_PUBLIC_X`
  // cuando se escribe entero (ver ADR-005).
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.trim() !== "" ? key.trim() : undefined;
}

export function isPushSupported(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  return (
    !!navigator.serviceWorker &&
    typeof window.PushManager !== "undefined" &&
    typeof window.Notification !== "undefined"
  );
}

export function getPushPermission(): PushPermissionState {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "denied";
  }
  return window.Notification.permission;
}

/**
 * `applicationServerKey` es un BufferSource: la clave VAPID llega en base64url y
 * hay que devolverla como bytes. Se le anade el relleno que le falte y se
 * normaliza el alfabeto url-safe antes de `atob`.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function serializeSubscription(
  subscription: PushSubscription,
): SerializedPushSubscription {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? "",
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
    expirationTime: json.expirationTime ?? null,
  };
}

export function loadStoredSubscription(): SerializedPushSubscription | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PUSH_SUBSCRIPTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedPushSubscription;
    if (!parsed || typeof parsed.endpoint !== "string") return null;
    return parsed;
  } catch {
    // Un valor corrupto no puede tumbar la interfaz: se trata como ausencia.
    return null;
  }
}

export function saveStoredSubscription(
  subscription: SerializedPushSubscription,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PUSH_SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify(subscription),
    );
  } catch {
    // Sin almacenamiento (modo privado, cuota) el flujo sigue: es un puente.
  }
}

export function clearStoredSubscription(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PUSH_SUBSCRIPTION_STORAGE_KEY);
  } catch {
    // Idem: borrar un puente que no existe no es un fallo.
  }
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(PUSH_SERVICE_WORKER_URL, {
    scope: "/",
    updateViaCache: "none",
  });
}

/** Suscripcion viva del navegador, o null. Es la fuente de verdad del estado. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Pide el permiso (solo si esta sin decidir), registra el service worker y
 * suscribe. Reutiliza la suscripcion existente en vez de crear otra. Guarda el
 * resultado en el puente de localStorage.
 */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<SerializedPushSubscription> {
  if (!isPushSupported()) {
    throw new Error("Este navegador no soporta notificaciones push");
  }
  if (!vapidPublicKey) {
    throw new Error("Falta la clave publica VAPID");
  }

  let permission = getPushPermission();
  if (permission === "default") {
    permission = await window.Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error("No hay permiso para mostrar notificaciones");
  }

  const registration = await registerPushServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const serialized = serializeSubscription(subscription);
  saveStoredSubscription(serialized);
  return serialized;
}

/**
 * Da de baja la suscripcion en el navegador y limpia el puente. Devuelve true si
 * habia algo que desuscribir.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  clearStoredSubscription();

  if (!subscription) return false;
  return subscription.unsubscribe();
}
