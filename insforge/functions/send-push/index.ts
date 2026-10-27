/// <reference lib="deno.ns" />
import { createAdminClient } from "npm:@insforge/sdk@1.5.2";

export const BATCH_SIZE = 10;
const MAX_SUBSCRIPTIONS = 20;
const SEND_TIMEOUT_MS = 5000;
const encoder = new TextEncoder();
export interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface Alert {
  id: string;
  user_id: string;
  title: string;
  message: string;
  trip_id: string | null;
}
export interface Config {
  secret?: string;
  privateKey?: string;
  subject?: string;
  baseUrl?: string;
  apiKey?: string;
}
export interface Store {
  claim: (token: string) => Promise<Alert[]>;
  subscriptions: (userId: string) => Promise<Subscription[]>;
  remove: (id: string) => Promise<void>;
  finish: (id: string, token: string, sentAt: string | null) => Promise<void>;
}
export interface Dependencies {
  config: () => Config;
  store: (config: Config) => Store;
  fetcher: typeof fetch;
  now: () => Date;
}

export function readConfig(): Config {
  return {
    secret: Deno.env.get("PUSH_SEND_SECRET"),
    privateKey: Deno.env.get("VAPID_PRIVATE_KEY"),
    subject: Deno.env.get("VAPID_SUBJECT"),
    baseUrl: Deno.env.get("INSFORGE_BASE_URL"),
    apiKey: Deno.env.get("API_KEY"),
  };
}

export function createStore(config: Config, fetcher: typeof fetch = fetch): Store {
  const client = createAdminClient({
    baseUrl: config.baseUrl!,
    apiKey: config.apiKey!,
    retryCount: 0,
    fetch: fetcher,
  });
  return {
    claim: async (token) => {
      const { data, error } = await client.database.rpc("claim_push_alerts", {
        claim_token: token,
        batch_size: BATCH_SIZE,
      })
        .abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS));
      if (error || !Array.isArray(data)) throw new Error("Database failure");
      return data as Alert[];
    },
    subscriptions: async (userId) => {
      const { data, error } = await client.database.from("push_subscriptions").select(
        "id,endpoint,p256dh,auth",
      )
        .eq("user_id", userId).order("last_seen_at", { ascending: false }).order("id").limit(
          MAX_SUBSCRIPTIONS,
        )
        .abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS));
      if (error || !data) throw new Error("Database failure");
      return data as Subscription[];
    },
    remove: async (id) => {
      const { error } = await client.database.from("push_subscriptions").delete().eq("id", id)
        .abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS));
      if (error) throw new Error("Database failure");
    },
    finish: async (id, token, sentAt) => {
      const update: { push_sent_at: string | null; push_claim_token: null; push_claimed_at?: null } = {
        push_sent_at: sentAt,
        push_claim_token: null,
      };
      if (sentAt !== null) update.push_claimed_at = null;
      const { data, error } = await client.database.from("alerts")
        .update(update)
        .eq("id", id).eq("push_claim_token", token).is("push_sent_at", null).select("id")
        .abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS));
      if (error || data?.length !== 1) throw new Error("Database failure");
    },
  };
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(
    /\//g,
    "_",
  );
}
function decode(value: string, length: number): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid key");
  const result = Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  if (result.length !== length) throw new Error("Invalid key");
  return result;
}
function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
async function hkdf(
  key: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number,
) {
  const material = await crypto.subtle.importKey("raw", key, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info },
      material,
      length * 8,
    ),
  );
}

// Only supported browser push services: never send user-controlled URLs to arbitrary hosts.
function pushEndpoint(value: string): URL {
  if (value.length > 4096) throw new Error("Invalid endpoint");
  const url = new URL(value);
  const allowed = url.hostname === "fcm.googleapis.com" || url.hostname === "web.push.apple.com" ||
    url.hostname === "updates.push.services.mozilla.com" ||
    /^[a-z0-9-]+\.push\.services\.mozilla\.com$/.test(url.hostname);
  if (
    !allowed || url.protocol !== "https:" || url.port || url.username || url.password || url.hash
  ) throw new Error("Invalid endpoint");
  return url;
}

async function vapidKey(config: Config) {
  if (!config.privateKey || !config.subject || !config.baseUrl || !config.apiKey) {
    throw new Error("Invalid config");
  }
  const subject = new URL(config.subject);
  if (!["mailto:", "https:"].includes(subject.protocol) || subject.username || subject.password) {
    throw new Error("Invalid subject");
  }
  // Private JWK contains d, x and y. The public point must match the key embedded at client build time.
  const jwk = JSON.parse(config.privateKey) as JsonWebKey;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") throw new Error("Invalid VAPID key");
  const publicBytes = concat(new Uint8Array([4]), decode(jwk.x!, 32), decode(jwk.y!, 32));
  decode(jwk.d!, 32);
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return { key, publicKey: base64url(publicBytes) };
}

async function webPush(
  subscription: Subscription,
  payload: Uint8Array<ArrayBuffer>,
  vapid: Awaited<ReturnType<typeof vapidKey>>,
  config: Config,
  now: Date,
  fetcher: typeof fetch,
): Promise<number> {
  const endpoint = pushEndpoint(subscription.endpoint);
  const uaPublic = decode(subscription.p256dh, 65);
  const uaAuth = decode(subscription.auth, 16);
  const receiver = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  // Ephemeral encryption key is distinct from the long-lived VAPID signing key (RFC 8292).
  const sender = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey("raw", sender.publicKey));
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: receiver }, sender.privateKey, 256),
  );
  const ikm = await hkdf(
    shared,
    uaAuth,
    concat(encoder.encode("WebPush: info\0"), uaPublic, senderPublic),
    32,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(ikm, salt, encoder.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aes,
      concat(payload, new Uint8Array([2])),
    ),
  );
  const record = new Uint8Array(5);
  new DataView(record.buffer).setUint32(0, 4096);
  record[4] = senderPublic.length;
  const body = concat(salt, record, senderPublic, encrypted);
  if (body.length > 4096) throw new Error("Payload too large");

  const header = base64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64url(
    encoder.encode(
      JSON.stringify({
        aud: endpoint.origin,
        exp: Math.floor(now.getTime() / 1000) + 3600,
        sub: config.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      vapid.key,
      encoder.encode(unsigned),
    ),
  );
  const response = await fetcher(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    body,
    headers: {
      Authorization: `vapid t=${unsigned}.${base64url(signature)}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "900",
      Urgency: "normal",
    },
  });
  await response.body?.cancel();
  return response.status;
}

const defaults: Dependencies = {
  config: readConfig,
  store: createStore,
  fetcher: fetch,
  now: () => new Date(),
};
export function createHandler(
  deps: Dependencies = defaults,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    try {
      const config = deps.config();
      const secret = request.headers.get("X-Push-Secret");
      if (!config.secret || !secret || secret.length > 4096) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const [expected, provided] = await Promise.all(
        [config.secret, secret].map(async (value) =>
          new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))
        ),
      );
      let difference = 0;
      for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ provided[i];
      if (difference !== 0) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const vapid = await vapidKey(config);
      const store = deps.store(config);
      const token = crypto.randomUUID();
      const alerts = (await store.claim(token)).slice(0, BATCH_SIZE);
      const counts = { sent: 0, deleted: 0, failed: 0 };
      for (const alert of alerts) {
        const subscriptions = (await store.subscriptions(alert.user_id)).slice(
          0,
          MAX_SUBSCRIPTIONS,
        );
        const payload = encoder.encode(
          JSON.stringify({
            title: alert.title.slice(0, 100),
            body: alert.message.slice(0, 500),
            url: alert.trip_id ? `/trip?id=${encodeURIComponent(alert.trip_id)}` : "/dashboard",
          }),
        );
        const settled = await Promise.allSettled(subscriptions.map(async (subscription) => {
          let status: number;
          try {
            status = await webPush(subscription, payload, vapid, config, deps.now(), deps.fetcher);
          } catch {
            return "failed" as const;
          }
          if (status === 404 || status === 410) {
            await store.remove(subscription.id);
            return "deleted" as const;
          }
          return status >= 200 && status < 300 ? "sent" as const : "failed" as const;
        }));
        const results = settled.filter((result) => result.status === "fulfilled").map((result) =>
          result.value
        );
        const sentAt = results.includes("sent") ? deps.now().toISOString() : null;
        await store.finish(alert.id, token, sentAt);
        for (const result of results) counts[result]++;
        if (settled.some((result) => result.status === "rejected")) {
          throw new Error("Database failure");
        }
      }
      return Response.json(counts);
    } catch {
      // No payloads, keys, endpoints or database details in logs/responses.
      return Response.json({ error: "Service unavailable" }, { status: 503 });
    }
  };
}
const handler = createHandler();
// InsForge sirve la función con su propio router: el entrypoint solo exporta el
// handler. Arrancar el servidor a mano aquí hace que el despliegue se rechace, y
// el validador del CLI busca esa cadena en todo el texto: tampoco se nombra en
// comentarios.
export default handler;
