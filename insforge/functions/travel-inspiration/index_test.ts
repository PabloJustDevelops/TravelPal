/// <reference lib="deno.ns" />
import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import travelInspiration, { createHandler, readConfig } from "./index.ts";

const now = new Date("2026-10-17T12:00:00.000Z");
const token = "provider-private-token";
const body = { origin: "mad", month: "2026-11", journey: "round-trip" };
const row = {
  origin: "MAD", destination: "LIS", depart_date: "2026-11-10",
  return_date: "2026-11-17", value: 120,
  found_at: "2026-10-17T10:00:00.000Z", number_of_changes: 1,
  actual: true, show_to_affiliates: true,
};

function fixture(options: {
  authenticated?: boolean;
  enabled?: boolean;
  providerToken?: string;
  configThrows?: boolean;
  fetcher?: typeof fetch;
} = {}) {
  let calls = 0;
  let fetchedUrl = "";
  let fetchedInit: RequestInit | undefined;
  const handler = createHandler({
    verifyAuth: async () => options.authenticated === false ? false : true,
    config: () => {
      if (options.configThrows) throw new Error("private config error");
      return {
        enabled: options.enabled === false ? "false" : "true",
        token: options.providerToken === undefined ? token : options.providerToken,
        insforgeUrl: "https://sjdq7zsn.eu-central.insforge.app",
      };
    },
    fetcher: async (input, init) => {
      calls++;
      fetchedUrl = String(input);
      fetchedInit = init;
      return options.fetcher ? options.fetcher(input, init) : Response.json({ success: true, data: [row] });
    },
    now: () => now,
  });
  const request = (value: unknown = body, method = "POST", origin = "https://travelpal.prg-dev.workers.dev") =>
    handler(new Request("https://function.test/travel-inspiration", {
      method, headers: { Authorization: "Bearer session-token", Origin: origin, "Content-Type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(value) } : {}),
    }));
  return { request, handler, calls: () => calls, fetchedUrl: () => fetchedUrl, fetchedInit: () => fetchedInit };
}

Deno.test("preflight permits only an allowed origin and rejects other methods", async () => {
  const f = fixture();
  const preflight = await f.request(undefined, "OPTIONS");
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get("access-control-allow-origin"), "https://travelpal.prg-dev.workers.dev");
  assertEquals((await f.request(undefined, "GET")).status, 405);
  const denied = await f.request(undefined, "OPTIONS", "https://evil.example");
  assertEquals(denied.headers.get("access-control-allow-origin"), null);
  assertEquals(f.calls(), 0);
});

Deno.test("rejects unauthenticated requests before provider fetch", async () => {
  const f = fixture({ authenticated: false });
  const response = await f.request();
  assertEquals(response.status, 401);
  assertEquals(f.calls(), 0);
});

Deno.test("rejects unknown, invalid and duplicate-style input", async () => {
  const f = fixture();
  for (const value of [{ ...body, rogue: "x" }, { ...body, maxPrice: 0 }, { ...body, origin: "MAD,MAD" }]) {
    assertEquals((await f.request(value)).status, 400);
  }
  assertEquals(f.calls(), 0);
});

Deno.test("rejects repeated JSON field names", async () => {
  const f = fixture();
  const response = await f.handler(new Request("https://function.test/travel-inspiration", {
    method: "POST",
    headers: { Authorization: "Bearer session-token", "Content-Type": "application/json" },
    body: '{"origin":"MAD","origin":"BCN","month":"2026-11","journey":"one-way"}',
  }));
  assertEquals(response.status, 400);
  assertEquals(f.calls(), 0);
});

Deno.test("returns unavailable when disabled and 503 when provider config is missing", async () => {
  const disabled = fixture({ enabled: false });
  assertEquals(await (await disabled.request()).json(), { status: "unavailable" });
  assertEquals(disabled.calls(), 0);
  const missing = fixture({ providerToken: "" });
  const response = await missing.request();
  assertEquals(response.status, 503);
  assertEquals(missing.calls(), 0);
});

Deno.test("configuration read failure returns a generic 503", async () => {
  const f = fixture({ configThrows: true });
  const response = await f.request();
  assertEquals(response.status, 503);
  assertEquals((await response.text()).includes("private"), false);
  assertEquals(f.calls(), 0);
});

Deno.test("checkOnly verifies auth and configuration without calling provider", async () => {
  assertEquals(typeof travelInspiration, "function");
  assertEquals(readConfig((name) => name === "INSFORGE_BASE_URL" ? "https://backend.example" : undefined).insforgeUrl,
    "https://backend.example");
  const f = fixture();
  const response = await f.request({ checkOnly: true });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "available" });
  assertEquals(f.calls(), 0);
});

Deno.test("requests EUR from fixed host with provider token only in X-Access-Token and normalizes rows", async () => {
  const f = fixture();
  const response = await f.request();
  assertEquals(response.status, 200);
  const result = await response.json();
  assertEquals(result.status, "ready");
  assertEquals(result.checkedAt, now.toISOString());
  assertEquals(result.ideas[0].price, 120);
  assertEquals(result.ideas[0].currency, "EUR");
  const url = new URL(f.fetchedUrl());
  assertEquals(url.origin, "https://api.travelpayouts.com");
  assertEquals(url.pathname, "/aviasales/v3/get_latest_prices");
  assertEquals(url.searchParams.get("currency"), "eur");
  assertEquals(url.searchParams.get("beginning_of_period"), "2026-11-01");
  assertEquals(url.searchParams.has("token"), false);
  assertEquals(f.fetchedInit()?.redirect, "error");
  const headers = new Headers(f.fetchedInit()?.headers);
  assertEquals(headers.get("X-Access-Token"), token);
  assertEquals(headers.get("authorization"), null);
  assertEquals(JSON.stringify(result).includes(token), false);
});

Deno.test("provider failure, malformed and oversized responses are generic 503", async () => {
  for (const response of [
    new Response("secret provider error", { status: 429 }),
    new Response("secret malformed", { status: 200 }),
    Response.json({ success: false, error: "secret provider error", data: [] }),
    new Response("x".repeat(300_000), { status: 200 }),
  ]) {
    const f = fixture({ fetcher: async () => response });
    const output = await f.request();
    assertEquals(output.status, 503);
    const text = await output.text();
    assertEquals(text.includes("secret"), false);
    assertEquals(text.includes(token), false);
  }
});

Deno.test("abort ends a stalled provider request with generic 503", async () => {
  const f = fixture({ fetcher: (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("secret timeout")), { once: true });
  }) });
  const output = await f.request();
  assertEquals(output.status, 503);
  assertMatch(await output.text(), /unavailable/i);
});
