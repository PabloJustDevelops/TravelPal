# ADR-001: Single server session adapter

## Context

The 12 route handlers under `src/app/api/**` each built their own server Supabase client (`createServerClient` + `cookies()`) and resolved the session on their own with `supabase.auth.getSession()`. The block was copied 21 times (with two comment variants), and each handler rewrote its own 401 response with different wording ("No autorizado" / "No autorizado. Por favor inicia sesión."). The `planning` handler also had a local `withAuth` helper that only covered its three methods.

`getSession()` loads the session from cookies without re-verifying the token against the Auth server. Supabase's documentation advises against trusting it in server code.

## Decision

Extract a single module at `src/lib/supabase/server.ts` that exports `createServerSupabaseClient()` and `requireUser()`. `requireUser()` verifies identity with `supabase.auth.getClaims()` (it validates the JWT signature; local verification when the project uses asymmetric keys) and returns a discriminated union:

- `{ ok: true, supabase, user }`, with `user` normalized (`id`, `email`, `user_metadata`) from the claims
- `{ ok: false, response }`, with 401 when there is no user and 500 when the Auth server fails

The 12 handlers consume `requireUser()`. `ensureUserExists` moves to the same module and becomes opt-in (POST handlers call it explicitly). The `withAuth` helper in `planning` is removed. The middleware stays separate: it runs on the edge runtime and uses the `get/set/remove` cookie API, which differs from `getAll/setAll`.

## Consequences

- 21 copies of the block become 1 seam; a single 401 message and a single session policy.
- `getClaims()` actually verifies the token; with symmetric keys that means one network call per request (with asymmetric keys, local verification).
- The 401/500 split is derived from `error.status` of `AuthError`: `0` or `>= 500` becomes 500; any other value (or no status) becomes 401.
- If `getClaims()` throws instead of returning an `AuthError` (a network failure, for instance), `requireUser()` catches it and responds with the same standardized 500; the exception never reaches the handler.
- Handlers no longer know how the client is built; the module is testable through `requireUser()`.
- `getSupabaseAdmin` is still unused and is out of scope for this change.

## Status

Obsolete. It describes the server session adapter on Supabase, which no longer exists
(`src/lib/supabase/server.ts` was replaced by `src/lib/insforge/server.ts`; see ADR-002).
It is kept as a historical record of why there is a single `requireUser()`.
