/// <reference lib="deno.ns" />
import { createClient } from "npm:@insforge/sdk";
import { parseFlightIdeas, parseInspirationQuery, parseTransitousItineraries } from "../../../src/lib/travel-inspiration.ts";

const PROVIDER_URL = "https://api.travelpayouts.com/aviasales/v3/get_latest_prices";
const ALLOWED_ORIGINS = new Set([
  "https://travelpal.prg-dev.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MAX_REQUEST_BYTES = 4096;
const MAX_RESPONSE_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 8000;
const GLOBAL_TIMEOUT_MS = 18000;
const MOTIS_URL = "https://api.transitous.org/api/v1";
const MAX_GROUND_IDEAS = 5;
const groundCache = new Map<string, { expires: number; ideas: unknown[] }>();

export function clearGroundCacheForTests(): void {
  groundCache.clear();
}

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
      if (Object.keys(input).some((key) => !["checkOnly", "mode", "origin", "destination", "date", "month", "journey", "maxPrice"].includes(key))) throw new Error();
      if (input.checkOnly !== undefined && typeof input.checkOnly !== "boolean") throw new Error();
      if (input.mode !== undefined && input.mode !== "flight" && input.mode !== "ground") throw new Error();
    } catch {
      return json({ error: "Invalid request" }, 400, headers);
    }

    const now = deps.now();
    let query;
    try {
      const { checkOnly, ...parameters } = input;
      delete parameters.mode;
      if (checkOnly === true && Object.keys(parameters).length === 0) {
        // Availability checks do not need search fields for either provider.
      } else if (input.mode === "ground") {
        if (typeof input.origin !== "string" || input.origin.trim().length < 2 || input.origin.trim().length > 100 ||
          typeof input.destination !== "string" || input.destination.trim().length < 2 || input.destination.trim().length > 100 ||
          typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error();
        const date = new Date(`${input.date}T00:00:00.000Z`);
        if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== input.date || date <= now) throw new Error();
      } else {
      if (checkOnly !== true || Object.keys(parameters).length > 0) {
        query = parseInspirationQuery(parameters, now);
      }
      if (checkOnly !== true && !query) throw new Error();
      }
    } catch {
      return json({ error: "Invalid request" }, 400, headers);
    }

    if (input.mode !== "ground" && config.enabled !== "true") return json({ status: "unavailable" }, 200, headers);
    if (!config.insforgeUrl || (input.mode !== "ground" && !config.token)) return json({ error: "Service unavailable" }, 503, headers);
    if (input.checkOnly === true) return json({ status: "available" }, 200, headers);

    if (input.mode === "ground") {
      const from = (input.origin as string).trim();
      const to = (input.destination as string).trim();
      const date = input.date as string;
      const normalizePlace = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
      const cacheKey = `${normalizePlace(from)}|${normalizePlace(to)}|${date}|ground`;
      const cached = groundCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return json({ status: "ready", ideas: cached.ideas }, 200, headers);
      if (cached) groundCache.delete(cacheKey);
      const global = new AbortController();
      const globalTimer = setTimeout(() => global.abort(), GLOBAL_TIMEOUT_MS);
      const motisFetch = async (url: URL) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
        const abort = () => controller.abort();
        global.signal.addEventListener("abort", abort, { once: true });
        try {
          const response = await deps.fetcher(url, { headers: { Accept: "application/json", "User-Agent": "travelpal" }, redirect: "error", signal: controller.signal });
          if (!response.ok) throw new Error("Transitous failure");
          const text = await limitedText(response.body, MAX_RESPONSE_BYTES);
          return JSON.parse(text) as unknown;
        } finally {
          clearTimeout(timer);
          global.signal.removeEventListener("abort", abort);
        }
      };
      try {
        const geocode = async (place: string): Promise<{ coordinates: string; name: string }> => {
          const url = new URL(`${MOTIS_URL}/geocode`);
          url.searchParams.set("text", place);
          const payload = await motisFetch(url);
          if (!Array.isArray(payload) || payload.length === 0) throw new Error("Transitous empty geocode");
          const found = payload.find((entry) => entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).lat === "number" && typeof (entry as Record<string, unknown>).lon === "number");
          if (!found) throw new Error("Transitous invalid geocode");
          const item = found as { lat: number; lon: number; name?: unknown };
          if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) throw new Error("Transitous invalid coordinates");
          return { coordinates: `${item.lat},${item.lon}`, name: typeof item.name === "string" ? item.name : "Transit stop" };
        };
        const fromPlace = await geocode(from);
        const toPlace = await geocode(to);
        const planUrl = new URL(`${MOTIS_URL}/plan`);
        planUrl.searchParams.set("fromPlace", fromPlace.coordinates);
        planUrl.searchParams.set("toPlace", toPlace.coordinates);
        planUrl.searchParams.set("time", `${date}T08:00:00Z`);
        planUrl.searchParams.set("numItineraries", String(MAX_GROUND_IDEAS));
        const payload = await motisFetch(planUrl);
        const ideas = parseTransitousItineraries(payload, fromPlace.name, toPlace.name).slice(0, MAX_GROUND_IDEAS);
        const timestamp = Date.now();
        for (const [key, entry] of groundCache) if (entry.expires <= timestamp) groundCache.delete(key);
        while (groundCache.size >= 100) groundCache.delete(groundCache.keys().next().value!);
        groundCache.set(cacheKey, { expires: timestamp + 10 * 60 * 1000, ideas });
        return json({ status: "ready", ideas }, 200, headers);
      } catch {
        return json({ status: "provider_error", ideas: [] }, 200, headers);
      } finally {
        clearTimeout(globalTimer);
      }
    }

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
        headers: { "X-Access-Token": config.token!, Accept: "application/json" },
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
// InsForge sirve la función con su propio router: el entrypoint solo exporta el
// handler. Un `Deno.serve()` aquí hace que el despliegue se rechace.
export default handler;
