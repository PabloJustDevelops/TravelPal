/// <reference lib="deno.ns" />
import { assertEquals } from "jsr:@std/assert@1";
import { createHandler, type Store } from "./index.ts";
const tripId = "123e4567-e89b-42d3-a456-426614174000";
const invitationId = "123e4567-e89b-42d3-a456-426614174001";

function fixture(options: { authenticated?: boolean; owner?: boolean; invitee?: string | null } = {}) {
  const calls: string[] = [];
  const store: Store = {
    ownerId: async () => { calls.push("owner"); return options.owner === false ? "other" : "caller"; },
    findUserId: async () => { calls.push("lookup"); return options.invitee === undefined ? "invitee" : options.invitee; },
    invite: async () => { calls.push("invite"); },
    cancel: async () => { calls.push("cancel"); },
    list: async () => { calls.push("list"); return { invitations: [], members: [] }; },
    inbox: async () => { calls.push("inbox"); return []; },
    respond: async () => { calls.push("respond"); },
  };
  const handler = createHandler({
    config: () => ({ insforgeUrl: "https://backend.example", apiKey: "server-only" }),
    verifyAuth: async () => options.authenticated !== false ? "caller" : null,
    store: () => store,
    now: () => 1_000,
  });
  const request = (body: unknown, authorization = "Bearer session") => handler(new Request("https://fn.test", {
    method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { calls, request };
}

Deno.test("invite responds uniformly when the requested email has no account", async () => {
  const f = fixture({ invitee: null });
  const response = await f.request({ action: "invite", tripId, email: "missing@example.com", role: "reader" });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "invited" });
  assertEquals(f.calls, ["owner", "lookup"]);
  const existing = fixture();
  const knownResponse = await existing.request({ action: "invite", tripId, email: "known@example.com", role: "reader" });
  assertEquals(knownResponse.status, response.status);
  assertEquals(await knownResponse.json(), { status: "invited" });
  assertEquals(existing.calls, ["owner", "lookup", "invite"]);
});

Deno.test("rejects non-owners before invitation lookup and writes", async () => {
  const f = fixture({ owner: false });
  const response = await f.request({ action: "invite", tripId, email: "person@example.com", role: "editor" });
  assertEquals(response.status, 403);
  assertEquals(f.calls, ["owner"]);
});

Deno.test("respond is delegated to an atomic store operation only after auth", async () => {
  const f = fixture();
  const response = await f.request({ action: "respond", invitationId, response: "accept" });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "accepted" });
  assertEquals(f.calls, ["respond"]);
});

Deno.test("inbox is scoped to the authenticated user", async () => {
  const f = fixture();
  const response = await f.request({ action: "inbox" });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { invitations: [] });
  assertEquals(f.calls, ["inbox"]);
});

Deno.test("rejects malformed actions and unauthenticated calls", async () => {
  assertEquals((await fixture().request({ action: "respond", invitationId, response: "other" })).status, 400);
  assertEquals((await fixture({ authenticated: false }).request({ action: "list", tripId })).status, 401);
});

Deno.test("limits authenticated requests per user in a one-minute window", async () => {
  const f = fixture();
  let last: Response | undefined;
  for (let index = 0; index < 21; index++) last = await f.request({ action: "list", tripId });
  assertEquals(last?.status, 429);
});
