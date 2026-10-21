/// <reference lib="deno.ns" />
import { createClient } from "npm:@insforge/sdk";
import { parseFlightIdeas, parseInspirationQuery } from "../../../src/lib/travel-inspiration.ts";

const PROVIDER_URL = "https://api.travelpayouts.com/aviasales/v3/get_latest_prices";
const ALLOWED_ORIGINS = new Set([
  "https://travelpal.prg-dev.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MAX_REQUEST_BYTES = 4096;
const MAX_RESPONSE_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 8000;

interface Config {
  enabled?: string;
  token?: string;
  insforgeUrl?: string;
}

interface Dependencies {
  verifyAuth: (bearer: string, config: Config) => Promise<boolean>;
  config: () => Config;
  fetcher: typeof fetch;
  now: () => Date;
}

export function readConfig(getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)): Config {
  return {
    enabled: getEnv("TRAVELPAYOUTS_ENABLED"),
    token: getEnv("TRAVELPAYOUTS_API_TOKEN"),
    insforgeUrl: getEnv("INSFORGE_BASE_URL"),
  };
}

function json(body: unknown, status: number, headers: Headers): Response {
  return Response.json(body, { status, headers });
}

function hasRepeatedTopLevelKeys(source: string): boolean {
  const keys = new Set<string>();
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") depth--;
    else if (char === '"') {
      const start = i;
      for (i++; i < source.length; i++) {
        if (source[i] === "\\") i++;
        else if (source[i] === '"') break;
      }
      if (depth !== 1) continue;
      let next = i + 1;
      while (/\s/.test(source[next] ?? "")) next++;
      if (source[next] !== ":") continue;
      const key = JSON.parse(source.slice(start, i + 1)) as string;
      if (keys.has(key)) return true;
      keys.add(key);
    }
  }
  return false;
}

async function limitedText(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Body too large");
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const defaultDependencies: Dependencies = {
  verifyAuth: async (bearer, config) => {
    if (!config.insforgeUrl) return false;
    const client = createClient({ baseUrl: config.insforgeUrl, accessToken: bearer });
    const { data, error } = await client.auth.getCurrentUser();
    return !error && Boolean(data?.user?.id);
  },
  config: readConfig,
  fetcher: fetch,
  now: () => new Date(),
};

export function createHandler(deps: Dependencies = defaultDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    const headers = new Headers({ Vary: "Origin" });
    const origin = request.headers.get("Origin");
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

    const authorization = request.headers.get("Authorization") ?? "";
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) return json({ error: "Unauthorized" }, 401, headers);

    let config: Config;
    try {
      config = deps.config();
    } catch {
      return json({ error: "Service unavailable" }, 503, headers);
    }
    if (!config.insforgeUrl) return json({ error: "Service unavailable" }, 503, headers);
    let authenticated = false;
    try {
      authenticated = await deps.verifyAuth(match[1], config);
    } catch {
      // Authentication failures have the same public response as missing sessions.
    }
    if (!authenticated) return json({ error: "Unauthorized" }, 401, headers);

    let input: Record<string, unknown>;
    try {
      const source = await limitedText(request.body, MAX_REQUEST_BYTES);
      input = JSON.parse(source);
      if (hasRepeatedTopLevelKeys(source)) throw new Error();
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
      if (Object.keys(input).some((key) => !["checkOnly", "origin", "month", "journey", "maxPrice"].includes(key))) throw new Error();
      if (input.checkOnly !== undefined && typeof input.checkOnly !== "boolean") throw new Error();
    } catch {
      return json({ error: "Invalid request" }, 400, headers);
    }

    const now = deps.now();
    let query;
    try {
      const { checkOnly, ...parameters } = input;
      if (checkOnly !== true || Object.keys(parameters).length > 0) {
        query = parseInspirationQuery(parameters, now);
      }
      if (checkOnly !== true && !query) throw new Error();
    } catch {
      return json({ error: "Invalid request" }, 400, headers);
    }

    if (config.enabled !== "true") return json({ status: "unavailable" }, 200, headers);
    if (!config.token || !config.insforgeUrl) return json({ error: "Service unavailable" }, 503, headers);
    if (input.checkOnly === true) return json({ status: "available" }, 200, headers);

    const params = new URLSearchParams({
      currency: "eur",
      origin: query!.origin,
      beginning_of_period: `${query!.month}-01`,
      period_type: "month",
      one_way: String(query!.journey === "one-way"),
      show_to_affiliates: "true",
      sorting: "price",
      page: "1",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const response = await deps.fetcher(`${PROVIDER_URL}?${params}`, {
        method: "GET",
        headers: { "X-Access-Token": config.token, Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Provider failure");
      const payload = JSON.parse(await limitedText(response.body, MAX_RESPONSE_BYTES));
      if (payload?.success !== true) throw new Error("Provider failure");
      const ideas = parseFlightIdeas(payload, query!, now);
      return json({ status: "ready", ideas, checkedAt: now.toISOString() }, 200, headers);
    } catch {
      return json({ error: "Service unavailable" }, 503, headers);
    } finally {
      clearTimeout(timeout);
    }
  };
}

const handler = createHandler();
export default handler;

if (import.meta.main) Deno.serve(handler);
