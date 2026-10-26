/// <reference lib="deno.ns" />
import { createAdminClient, createClient } from "npm:@insforge/sdk@1.5.2";

const MAX_REQUEST_BYTES = 4096;
const REQUEST_TIMEOUT_MS = 6000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const ALLOWED_ORIGINS = new Set([
  "https://travelpal.prg-dev.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export interface Config { insforgeUrl?: string; apiKey?: string; }
export interface CollaborationList { invitations: unknown[]; members: unknown[]; }
export interface InvitationInboxItem { id: string; trip_id: string; trip_title: string; role: "editor" | "reader"; created_at: string; invited_by_email: string; }
export interface Store {
  ownerId(tripId: string): Promise<string | null>;
  findUserId(email: string): Promise<string | null>;
  invite(tripId: string, invitedUserId: string, invitedBy: string, role: "editor" | "reader"): Promise<void>;
  cancel(tripId: string, invitationId: string): Promise<void>;
  list(tripId: string, ownerId: string): Promise<CollaborationList>;
  inbox(userId: string): Promise<InvitationInboxItem[]>;
  respond(invitationId: string, userId: string, response: "accept" | "reject"): Promise<void>;
}
export interface Dependencies {
  config: () => Config;
  verifyAuth: (bearer: string, config: Config) => Promise<string | null>;
  store: (config: Config) => Store;
  now: () => number;
}

export function readConfig(getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)): Config {
  return { insforgeUrl: getEnv("INSFORGE_BASE_URL"), apiKey: getEnv("API_KEY") };
}

const defaultDependencies: Dependencies = {
  config: readConfig,
  verifyAuth: async (bearer, config) => {
    if (!config.insforgeUrl) return null;
    const client = createClient({ baseUrl: config.insforgeUrl, accessToken: bearer, timeout: REQUEST_TIMEOUT_MS, retryCount: 0 });
    const { data, error } = await client.auth.getCurrentUser();
    return error ? null : data?.user?.id ?? null;
  },
  store: (config) => {
    if (!config.insforgeUrl || !config.apiKey) throw new Error("Configuration missing");
    const client = createAdminClient({ baseUrl: config.insforgeUrl, apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS, retryCount: 0 });
    return {
      ownerId: async (tripId) => {
        const { data, error } = await client.database.from("trips").select("user_id").eq("id", tripId).limit(1);
        if (error) throw new Error("Database failure");
        const rows = Array.isArray(data) ? data : [];
        return (rows[0] as { user_id?: string } | undefined)?.user_id ?? null;
      },
      findUserId: async (email) => {
        const { data, error } = await client.database.rpc("find_trip_invitee", { requested_email: email })
          .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
        if (error) throw new Error("Database failure");
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        return (rows[0] as { user_id?: string } | undefined)?.user_id ?? null;
      },
      invite: async (tripId, invitedUserId, invitedBy, role) => {
        const { error } = await client.database.rpc("create_trip_invitation", {
          target_trip_id: tripId, target_user_id: invitedUserId, actor_id: invitedBy, invitation_role: role,
        }).abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
        if (error) throw new Error("Database failure");
      },
      cancel: async (tripId, invitationId) => {
        const { error } = await client.database.from("trip_invitations")
          .update({ state: "revoked" }).eq("trip_id", tripId).eq("id", invitationId).eq("state", "pending")
          .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
        if (error) throw new Error("Database failure");
      },
      list: async (tripId, ownerId) => {
        const { data, error } = await client.database.rpc("list_trip_collaboration", {
          target_trip_id: tripId, actor_id: ownerId,
        }).abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
        if (error || !data || typeof data !== "object") throw new Error("Database failure");
        const result = data as CollaborationList;
        return { invitations: Array.isArray(result.invitations) ? result.invitations : [], members: Array.isArray(result.members) ? result.members : [] };
      },
      inbox: async (userId) => {
        const { data, error } = await client.database.rpc("list_my_trip_invitations", { actor_id: userId })
          .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
        if (error || !Array.isArray(data)) throw new Error("Database failure");
        return data as InvitationInboxItem[];
      },
      respond: async (invitationId, userId, response) => {
        const { data, error } = await client.database.rpc("respond_trip_invitation", {
          target_invitation_id: invitationId, actor_id: userId, invitation_response: response,
        }).abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
        if (error || data !== response) throw new Error("Invitation response failed");
      },
    };
  },
  now: () => Date.now(),
};

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function response(body: unknown, status: number, headers: Headers): Response {
  return Response.json(body, { status, headers });
}

function parseRequest(request: Request): Promise<Record<string, unknown>> {
  return new Promise(async (resolve, reject) => {
    try {
      const reader = request.body?.getReader();
      if (!reader) return reject(new Error("invalid"));
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_REQUEST_BYTES) throw new Error("large");
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      resolve(parsed as Record<string, unknown>);
    } catch { reject(new Error("invalid")); }
  });
}

export function createHandler(deps: Dependencies = defaultDependencies): (request: Request) => Promise<Response> {
  const rate = new Map<string, { start: number; count: number }>();
  return async (request) => {
    const headers = new Headers({ Vary: "Origin" });
    const origin = request.headers.get("Origin");
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405, headers);
    const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("Authorization") ?? "");
    if (!match) return response({ error: "Unauthorized" }, 401, headers);
    let config: Config;
    try { config = deps.config(); } catch { return response({ error: "Service unavailable" }, 503, headers); }
    if (!config.insforgeUrl || !config.apiKey) return response({ error: "Service unavailable" }, 503, headers);
    let userId: string | null = null;
    try { userId = await deps.verifyAuth(match[1], config); } catch { /* generic auth response */ }
    if (!userId) return response({ error: "Unauthorized" }, 401, headers);
    const authenticatedUserId = userId;
    const now = deps.now();
    const current = rate.get(userId);
    if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) rate.set(userId, { start: now, count: 1 });
    else if (++current.count > RATE_LIMIT_MAX) return response({ error: "Too many requests" }, 429, headers);
    let input: Record<string, unknown>;
    try { input = await parseRequest(request); } catch { return response({ error: "Invalid request" }, 400, headers); }
    const action = input.action;
    const allowed: Record<string, string[]> = {
      invite: ["action", "tripId", "email", "role"], cancel: ["action", "tripId", "invitationId"],
      list: ["action", "tripId"], inbox: ["action"], respond: ["action", "invitationId", "response"],
    };
    if (typeof action !== "string" || !allowed[action] || Object.keys(input).some((key) => !allowed[action].includes(key))) {
      return response({ error: "Invalid request" }, 400, headers);
    }
    const tripId = input.tripId;
    if (!["respond", "inbox"].includes(action) && !validId(tripId)) return response({ error: "Invalid request" }, 400, headers);
    if (action === "respond" && (!validId(input.invitationId) || !["accept", "reject"].includes(String(input.response)))) {
      return response({ error: "Invalid request" }, 400, headers);
    }
    if (action === "invite" && (typeof input.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || !["editor", "reader"].includes(String(input.role)))) {
      return response({ error: "Invalid request" }, 400, headers);
    }
    if (action === "cancel" && !validId(input.invitationId)) return response({ error: "Invalid request" }, 400, headers);
    let store: Store;
    try { store = deps.store(config); } catch { return response({ error: "Service unavailable" }, 503, headers); }
    try {
      if (action === "respond") {
        await store.respond(input.invitationId as string, authenticatedUserId, input.response as "accept" | "reject");
        return response({ status: input.response === "accept" ? "accepted" : "rejected" }, 200, headers);
      }
      if (action === "inbox") return response({ invitations: await store.inbox(authenticatedUserId) }, 200, headers);
      const ownerId = await store.ownerId(tripId as string);
      if (ownerId !== authenticatedUserId) return response({ error: "Forbidden" }, 403, headers);
      if (action === "invite") {
        const inviteeId = await store.findUserId((input.email as string).trim().toLowerCase());
        if (inviteeId && inviteeId !== authenticatedUserId) await store.invite(tripId as string, inviteeId, authenticatedUserId, input.role as "editor" | "reader");
        return response({ status: "invited" }, 200, headers);
      }
      if (action === "cancel") {
        await store.cancel(tripId as string, input.invitationId as string);
        return response({ status: "revoked" }, 200, headers);
      }
      return response(await store.list(tripId as string, authenticatedUserId), 200, headers);
    } catch {
      return response({ error: "Service unavailable" }, 503, headers);
    }
  };
}

const handler = createHandler();
export default handler;
