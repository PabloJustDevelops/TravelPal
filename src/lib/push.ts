/**
 * Suscripciones Web Push del navegador y persistencia del propietario en InsForge.
 * El navegador determina el estado del permiso y la suscripción; push_subscriptions
 * permite al servidor enviar avisos. localStorage conserva una caché para la baja.
 */
import { createInsforgeClient } from "@/lib/insforge";

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
    // Sin caché (modo privado, cuota), la persistencia del servidor sigue disponible.
  }
}

export function clearStoredSubscription(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PUSH_SUBSCRIPTION_STORAGE_KEY);
  } catch {
    // Borrar una caché que no existe no es un fallo.
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

// Serializa mutaciones entre la reconciliación global y el interruptor de Ajustes.
let pendingMutation: Promise<unknown> = Promise.resolve();
function mutatePush<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingMutation.then(operation);
  pendingMutation = result.catch(() => undefined);
  return result;
}

class EndpointOwnershipConflict extends Error {}

async function upsertSubscription(
  subscription: PushSubscription,
): Promise<SerializedPushSubscription> {
  const client = createInsforgeClient();
  const { data, error: authError } = await client.auth.getCurrentUser();
  if (authError || !data?.user?.id) {
    throw new Error("No se pudo verificar la sesión para guardar la suscripción");
  }
  const serialized = serializeSubscription(subscription);
  if (!serialized.endpoint || !serialized.keys.p256dh || !serialized.keys.auth) {
    throw new Error("La suscripción del navegador no contiene las claves necesarias");
  }
  const { error } = await client.database.from("push_subscriptions").upsert([{
    user_id: data.user.id,
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
    user_agent: navigator.userAgent,
    last_seen_at: new Date().toISOString(),
  }], { onConflict: "endpoint" });
  if (error) {
    if (error.code === "42501" || error.code === "23505") throw new EndpointOwnershipConflict();
    throw new Error("No se pudo guardar la suscripción de notificaciones");
  }
  saveStoredSubscription(serialized);
  return serialized;
}

async function persistSubscription(
  subscription: PushSubscription,
  vapidPublicKey?: string,
): Promise<SerializedPushSubscription> {
  try {
    return await upsertSubscription(subscription);
  } catch (error) {
    if (!(error instanceof EndpointOwnershipConflict)) throw error;
    // RLS no permite apropiarse del endpoint de otra cuenta. Invalida el anterior
    // y genera uno nuevo; la función de envío limpiará la fila antigua tras 404/410.
    if (!await subscription.unsubscribe()) {
      throw new Error("No se pudo renovar la suscripción de notificaciones");
    }
    clearStoredSubscription();
    if (!vapidPublicKey) {
      throw new Error("Falta la clave pública VAPID para renovar la suscripción");
    }
    const registration = await registerPushServiceWorker();
    const replacement = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    // Un segundo error se propaga: nunca hay un bucle de renovación.
    return upsertSubscription(replacement);
  }
}

/** Recupera una fila borrada y refresca last_seen_at sin pedir permiso al arrancar. */
export function syncPushSubscription(): Promise<void> {
  return mutatePush(async () => {
    const subscription = await getExistingSubscription();
    if (subscription) await persistSubscription(subscription, getVapidPublicKey());
  });
}

/** Pide permiso desde un gesto y guarda la suscripción del navegador en InsForge. */
export async function subscribeToPush(vapidPublicKey: string): Promise<SerializedPushSubscription> {
  if (!isPushSupported()) throw new Error("Este navegador no soporta notificaciones push");
  if (!vapidPublicKey) throw new Error("Falta la clave publica VAPID");
  // Mantener la petición de permiso dentro del gesto, antes de esperar red o la cola.
  let permission = getPushPermission();
  if (permission === "default") permission = await window.Notification.requestPermission();
  if (permission !== "granted") throw new Error("No hay permiso para mostrar notificaciones");
  return mutatePush(async () => {
    const registration = await registerPushServiceWorker();
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    return persistSubscription(subscription, vapidPublicKey);
  });
}

/** Borra la fila propia antes de cancelar el navegador; una fila ausente no es un error. */
export function unsubscribeFromPush(): Promise<boolean> {
  return mutatePush(async () => {
    if (!isPushSupported()) return false;
    const subscription = await getExistingSubscription();
    const endpoint = subscription
      ? serializeSubscription(subscription).endpoint
      : loadStoredSubscription()?.endpoint;
    if (endpoint) {
      const client = createInsforgeClient();
      const { data, error: authError } = await client.auth.getCurrentUser();
      if (authError || !data?.user?.id) {
        throw new Error("No se pudo verificar la sesión para borrar la suscripción");
      }
      const { error } = await client.database.from("push_subscriptions").delete()
        .eq("endpoint", endpoint).eq("user_id", data.user.id);
      if (error) throw new Error("No se pudo borrar la suscripción de notificaciones");
    }
    if (!subscription) {
      clearStoredSubscription();
      return false;
    }
    const removed = await subscription.unsubscribe();
    if (removed) clearStoredSubscription();
    return removed;
  });
}
