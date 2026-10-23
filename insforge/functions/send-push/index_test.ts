/// <reference lib="deno.ns" />
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  type Alert,
  BATCH_SIZE,
  type Config,
  createHandler,
  createStore,
  type Subscription,
} from "./index.ts";

const encoder = new TextEncoder();
const now = new Date("2026-10-23T12:00:00Z");
const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const privateJwk = await crypto.subtle.exportKey("jwk", vapid.privateKey);
const receiver = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
  "deriveBits",
]);
function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(
    /\//g,
    "_",
  );
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}
const auth = crypto.getRandomValues(new Uint8Array(16));
const subscription: Subscription = {
  id: "subscription-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/device",
  p256dh: base64(new Uint8Array(await crypto.subtle.exportKey("raw", receiver.publicKey))),
  auth: base64(auth),
};
const alert: Alert = {
  id: "alert-1",
  user_id: "user-1",
  title: "Reserva",
  message: "Tu viaje",
  trip_id: null,
};
const config: Config = {
  secret: "test-service-secret",
  privateKey: JSON.stringify(privateJwk),
  subject: "mailto:ops@example.com",
  baseUrl: "https://db.example.com",
  apiKey: "test-admin",
};

function fixture(
  options: {
    alerts?: Alert[];
    subscriptions?: Subscription[];
    fetcher?: typeof fetch;
    config?: Config;
    failFinish?: boolean;
    failRemove?: boolean;
  } = {},
) {
  const finished: { id: string; sentAt: string | null }[] = [];
  const removed: string[] = [];
  let claims = 0;
  let sends = 0;
  const handler = createHandler({
    config: () => options.config ?? config,
    now: () => now,
    store: () => ({
      claim: async () => {
        claims++;
        return options.alerts ?? [alert];
      },
      subscriptions: async () => options.subscriptions ?? [subscription],
      remove: async (id) => {
        if (options.failRemove) throw new Error("private db detail");
        removed.push(id);
      },
      finish: async (id, _token, sentAt) => {
        if (options.failFinish) throw new Error("private db detail");
        finished.push({ id, sentAt });
      },
    }),
    fetcher: async (input, init) => {
      sends++;
      return options.fetcher ? options.fetcher(input, init) : new Response(null, { status: 201 });
    },
  });
  const request = (headers: HeadersInit = { "X-Push-Secret": config.secret! }, method = "POST") =>
    handler(new Request("https://function.test", { method, headers }));
  return { handler, request, finished, removed, claims: () => claims, sends: () => sends };
}

Deno.test("database finish retains failed claim age and clears it after success", async () => {
  const requests: Request[] = [];
  const store = createStore(config, async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(JSON.stringify([{ id: alert.id }]), {
      headers: { "Content-Type": "application/json", "Content-Range": "0-0/*" },
    });
  });

  await store.finish(alert.id, "claim-token", null);
  await store.finish(alert.id, "claim-token", now.toISOString());

  assertEquals(requests.map((request) => request.method), ["PATCH", "PATCH"]);
  assertEquals(JSON.parse(await requests[0].text()), {
    push_sent_at: null,
    push_claim_token: null,
  });
  assertEquals(JSON.parse(await requests[1].text()), {
    push_sent_at: now.toISOString(),
    push_claim_token: null,
    push_claimed_at: null,
  });
  for (const request of requests) {
    const url = new URL(request.url);
    assertEquals(url.searchParams.get("id"), `eq.${alert.id}`);
    assertEquals(url.searchParams.get("push_claim_token"), "eq.claim-token");
    assertEquals(url.searchParams.get("push_sent_at"), "is.null");
  }
});

Deno.test("service secret is mandatory; user bearer never grants access", async () => {
  for (
    const headers of [{}, { Authorization: "Bearer user-session" }, {
      "X-Push-Secret": "wrong",
    }] as HeadersInit[]
  ) {
    const f = fixture();
    const response = await f.request(headers);
    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized" });
    assertEquals(f.claims(), 0);
  }
  assertEquals((await fixture({ config: { ...config, secret: undefined } }).request()).status, 401);
});

Deno.test("only POST is accepted and no browser CORS is exposed", async () => {
  const response = await fixture().request(undefined, "OPTIONS");
  assertEquals(response.status, 405);
  assertEquals(response.headers.has("Access-Control-Allow-Origin"), false);
});

for (const tripId of [null, "trip 42/ñ"]) {
  Deno.test(`delivery has valid VAPID and RFC8291 ciphertext (trip: ${tripId})`, async () => {
    const f = fixture({
      alerts: [{ ...alert, trip_id: tripId }],
      fetcher: async (_input, init) => {
        const headers = new Headers(init?.headers);
        assertEquals(headers.get("Content-Encoding"), "aes128gcm");
        assertEquals(init?.redirect, "error");
        assertEquals(Boolean(init?.signal), true);
        const authorization = /^vapid t=([^,]+), k=(.+)$/.exec(headers.get("Authorization")!)!;
        const [head, claims, signature] = authorization[1].split(".");
        assertEquals(JSON.parse(new TextDecoder().decode(decode(head))), {
          typ: "JWT",
          alg: "ES256",
        });
        assertEquals(JSON.parse(new TextDecoder().decode(decode(claims))), {
          aud: "https://fcm.googleapis.com",
          exp: Math.floor(now.getTime() / 1000) + 3600,
          sub: config.subject,
        });
        const publicKey = await crypto.subtle.importKey(
          "raw",
          decode(authorization[2]),
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
        assertEquals(
          await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            publicKey,
            decode(signature),
            encoder.encode(`${head}.${claims}`),
          ),
          true,
        );
        const body = new Uint8Array(await new Response(init?.body).arrayBuffer());
        assertEquals(new DataView(body.buffer).getUint32(16), 4096);
        assertEquals(body[20], 65);
        const senderBytes = body.slice(21, 86);
        assertEquals(base64(senderBytes) === authorization[2], false);
        const senderKey = await crypto.subtle.importKey(
          "raw",
          senderBytes,
          { name: "ECDH", namedCurve: "P-256" },
          false,
          [],
        );
        const shared = new Uint8Array(
          await crypto.subtle.deriveBits(
            { name: "ECDH", public: senderKey },
            receiver.privateKey,
            256,
          ),
        );
        const info = new Uint8Array([
          ...encoder.encode("WebPush: info\0"),
          ...decode(subscription.p256dh),
          ...senderBytes,
        ]);
        async function hkdf(
          key: Uint8Array<ArrayBuffer>,
          salt: Uint8Array<ArrayBuffer>,
          info: Uint8Array<ArrayBuffer>,
          bits: number,
        ) {
          return crypto.subtle.deriveBits(
            { name: "HKDF", hash: "SHA-256", salt, info },
            await crypto.subtle.importKey("raw", key, "HKDF", false, ["deriveBits"]),
            bits,
          );
        }
        const ikm = new Uint8Array(await hkdf(shared, auth, info, 256));
        const cek = await hkdf(
          ikm,
          body.slice(0, 16),
          encoder.encode("Content-Encoding: aes128gcm\0"),
          128,
        );
        const nonce = await hkdf(
          ikm,
          body.slice(0, 16),
          encoder.encode("Content-Encoding: nonce\0"),
          96,
        );
        const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
        const plain = new Uint8Array(
          await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, body.slice(86)),
        );
        assertEquals(plain[plain.length - 1], 2);
        assertEquals(JSON.parse(new TextDecoder().decode(plain.slice(0, -1))), {
          title: alert.title,
          body: alert.message,
          url: tripId ? `/trip?id=${encodeURIComponent(tripId)}` : "/dashboard",
        });
        // A changed nonce must fail authentication during decryption.
        await assertRejects(() =>
          crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(12) }, aes, body.slice(86))
        );
        return new Response(null, { status: 201 });
      },
    });
    const response = await f.request();
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { sent: 1, deleted: 0, failed: 0 });
    assertEquals(f.finished, [{ id: alert.id, sentAt: now.toISOString() }]);
  });
}

for (const status of [404, 410]) {
  Deno.test(`${status} deletes stale subscriptions and leaves alert unsent`, async () => {
    const f = fixture({ fetcher: async () => new Response(null, { status }) });
    assertEquals(await (await f.request()).json(), { sent: 0, deleted: 1, failed: 0 });
    assertEquals(f.removed, [subscription.id]);
    assertEquals(f.finished, [{ id: alert.id, sentAt: null }]);
  });
}

for (const status of [400, 401, 429, 500]) {
  Deno.test(`${status} leaves the alert pending for retry`, async () => {
    const f = fixture({ fetcher: async () => new Response(null, { status }) });
    assertEquals(await (await f.request()).json(), { sent: 0, deleted: 0, failed: 1 });
    assertEquals(f.removed, []);
    assertEquals(f.finished, [{ id: alert.id, sentAt: null }]);
  });
}

Deno.test("network failure does not mark delivery; a partial success does", async () => {
  const f = fixture({
    subscriptions: [subscription, { ...subscription, id: "second" }],
    fetcher: async () => {
      throw new Error("private endpoint");
    },
  });
  assertEquals(await (await f.request()).json(), { sent: 0, deleted: 0, failed: 2 });
  assertEquals(f.finished[0].sentAt, null);
  let calls = 0;
  const partial = fixture({
    subscriptions: [subscription, { ...subscription, id: "second" }],
    fetcher: async () => new Response(null, { status: ++calls === 1 ? 201 : 500 }),
  });
  assertEquals(await (await partial.request()).json(), { sent: 1, deleted: 0, failed: 1 });
  assertEquals(partial.finished[0].sentAt, now.toISOString());
});

Deno.test("empty subscriptions and oversized batches do not mark undelivered alerts", async () => {
  const empty = fixture({ subscriptions: [] });
  assertEquals(await (await empty.request()).json(), { sent: 0, deleted: 0, failed: 0 });
  assertEquals(empty.finished[0].sentAt, null);
  const batch = fixture({
    alerts: Array.from({ length: 30 }, (_, i) => ({ ...alert, id: `a-${i}` })),
  });
  assertEquals((await batch.request()).status, 200);
  assertEquals(batch.sends(), BATCH_SIZE);
});

Deno.test("untrusted endpoints cannot cause SSRF; malformed keys are isolated", async () => {
  for (
    const endpoint of [
      "http://fcm.googleapis.com/x",
      "https://127.0.0.1/x",
      "https://internal.example/x",
      "https://fcm.googleapis.com.evil.test/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
    ]
  ) {
    const f = fixture({ subscriptions: [{ ...subscription, endpoint }] });
    assertEquals(await (await f.request()).json(), { sent: 0, deleted: 0, failed: 1 });
    assertEquals(f.sends(), 0);
    assertEquals(f.finished[0].sentAt, null);
  }
  const malformed = fixture({ subscriptions: [{ ...subscription, auth: "broken" }, subscription] });
  assertEquals(await (await malformed.request()).json(), { sent: 1, deleted: 0, failed: 1 });
});

Deno.test("database failures are generic and never report a committed delivery", async () => {
  const f = fixture({ failFinish: true });
  const response = await f.request();
  assertEquals(response.status, 503);
  assertEquals(await response.json(), { error: "Service unavailable" });
  const badConfig = fixture({ config: { ...config, privateKey: undefined } });
  assertEquals((await badConfig.request()).status, 503);
  assertEquals(badConfig.claims(), 0);
});

Deno.test("cleanup failure after a successful sibling delivery still persists that delivery", async () => {
  let calls = 0;
  const f = fixture({
    failRemove: true,
    subscriptions: [subscription, { ...subscription, id: "second" }],
    fetcher: async () => new Response(null, { status: ++calls === 1 ? 410 : 201 }),
  });
  assertEquals((await f.request()).status, 503);
  assertEquals(f.finished, [{ id: alert.id, sentAt: now.toISOString() }]);
});
