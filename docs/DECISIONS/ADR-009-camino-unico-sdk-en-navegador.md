# ADR-009: A single data path, the InsForge SDK in the browser

## Context

The app read and wrote the same data through two paths at once: the InsForge SDK in the browser
(`createInsforgeClient()`, `src/lib/insforge.ts`) and a BFF of route handlers under
`src/app/api/<domain>` that the pages called with `fetch` or with the `useApiResource` hook. [#38]
measured it and wrote it down: some pages used both paths in the same file (`notes`, `planning`), a
model change meant touching two places, and errors behaved differently depending on which path the
request had taken.

The BFF added no logic. The read handlers were two or three `SELECT`s in parallel returned raw (the
`dashboard` one was `trips`, `expenses` and `budgets`, with nothing aggregated) and the aggregation
and calculation lived in the browser. Each request also paid an extra network call: `requireUser()`
(`src/lib/insforge/server.ts`) calls `client.auth.getCurrentUser()`, which in server mode performs
`GET /api/auth/sessions/current` (`node_modules/@insforge/sdk/dist/index.mjs:1332`) before touching
the database. And every `route.ts` grew the server build and the Worker (the exact number is measured
in [#38]).

Between stage 0 and stage 3 of [#38] the domains were migrated one by one (`notes`, `tasks`, `trips`,
`expenses`, `budget`, `planning`, `dashboard`), deleting each endpoint in the same PR that migrated
its calls. With `dashboard` the last point of the BFF path goes out and this decision no longer rests
on code: this ADR records it.

## Decision

1. A single data path for user data: the InsForge SDK in the browser. Pages and components read and
   write with `createInsforgeClient().database.from(...)`. `src/app/api/dashboard/route.ts` is
   deleted with its last calls and the guard reports `puntos bff: 0 / 0` and
   `sin dominio 0 / 0`: no user-data endpoint survives.
2. Authorization is decided by RLS, not by the BFF.
   `migrations/20260913181842_create-app-schema.sql` enables RLS on the tables and creates
   `auth.uid() = user_id` policies on those with an owner (and `auth.uid() = id` in
   `users`/`profiles`). Per-user isolation was not added by `requireUser()`: the database already
   enforces it.
3. The seam is the SDK called directly from the page, with no data module layer. There is no
   `insforge-functions.ts` and no per-domain module: pages call the SDK. The trigger for extracting
   one is the third use of the same `select` or the same mapping: two copies are tolerated, the third
   is extracted into a module. `src/lib/insforge-query.ts` is not that data layer: it wraps no domain
   and decides no queries, it is two cross-cutting functions applied to any query, the affected-rows
   guard (`assertRowsAffected`, [#53]) and the wait wrapper (`withQueryTimeout`, [#56]). The existence
   of that file does not open the door to an `insforge-functions.ts` per domain: the third-use trigger
   still stands.
4. The guard stops freezing and becomes a fence. `scripts/check-data-paths.mjs` with
   `scripts/data-paths-baseline.json` no longer measures pending debt (everything at zero): it now
   forbids going back to the BFF. Any new `fetch('/api/<domain>')` or `useApiResource('/api/<domain>')`,
   whether a literal or a URL in a variable, breaks the build.
5. Only what cannot move down to the client survives on the server.

## Endpoints that survive

| Endpoint | Why it cannot move down to the client |
|---|---|
| `src/app/api/auth/refresh/route.ts` | The refresh token is httpOnly. It is served by `createRefreshAuthRouter()` (`@insforge/sdk/ssr`), which rotates the refresh token and publishes the new access token in a cookie. |

`chat` and `flights/search` were also BFF, but they were already retired in previous tasks (the
assistant in [ADR-008](ADR-008-retirada-del-asistente.md) and the Amadeus proxy in
[ADR-006](ADR-006-vuelos-de-amadeus-a-entrada-manual.md)). No other `route.ts` remains under
`src/app/api`.

## Consequences

- The explicit 401 is lost. With RLS, a user without a session who queries a table receives `200 []`
  instead of `401`, and the 500 "Error de autenticación" from a failed verification disappears. It is
  a change in error semantics, not in access: the middleware redirects to `/signin` on protected
  routes when there is no session (`src/proxy.ts`) and `ProtectedRoute` repeats it on the client.
- The hiding of query shape is lost. The client now knows which columns and filters the app uses.
  With RLS that is not a security problem, but it is information that used to stay on the server.
- The per-query `logger.error` from the handler is lost. The `useApiResource` hook emitted it on
  every load; with the SDK, logging is up to each page. The 15 s timeout that hook also had is not
  lost: `withQueryTimeout` returns it (`src/lib/insforge-query.ts`), and the migrated pages and
  components use it (see "Losses closed by stage 4").
- Without the BFF there are no 400s or 500s of its own. Whatever the handler validated (the
  `dashboard` one validated nothing: it had no 400) goes with it; SDK errors are shown as they are.
- `requireUser()`, `ensureUserExists()` and `useApiResource` are left without callers (only their
  tests). `createServerInsforgeClient()` is still alive because `auth-actions.ts` uses it. Retiring
  the dead code is stage 4 cleanup.
- One network call fewer per request: the `GET /api/auth/sessions/current` that `requireUser()` paid
  in each handler disappears.
- Less server code: the user-data `route.ts` files, with their methods and endpoint tests, no longer
  exist.

## Losses closed by stage 4

The two losses this decision recorded were fixed in stage 4 itself, without reopening the single
path:

- [#53]: with RLS, an `update`/`delete` on a row that belongs to someone else or does not exist comes
  back with zero rows and no error, so the UI could announce a success that had not happened. The
  `assertRowsAffected` guard (`src/lib/insforge-query.ts`, commit `28a40e1`) turns those zero rows
  into a typed failure; mutations chain `.select()` to ask the backend for the affected rows.
- [#56]: since the BFF was retired, no browser SDK query had a ceiling: if the network or the backend
  hung, the spinner never stopped and the user got neither an error nor a message. The
  `withQueryTimeout` wrapper (`src/lib/insforge-query.ts`, commit `77e97ed`) restores the 15 s cut and
  distinguishes the timeout (`QueryTimeoutError`) from the SDK error, without aborting the request
  underneath: the timeout is on the client's wait. It was applied to the migrated pages (`b8fb2c5`)
  and to the components that query (`a9b33c9`), with the timeout message kept separate from the
  generic one.

## Why it is hard to revert

Going back to the BFF is not undoing a commit: it requires rewriting a handler per domain, rewiring
the pages with `fetch`/`useApiResource`, adapting their tests and paying the extra auth call per
request again. The guard forbids it by default, so reintroducing the BFF is an explicit decision with
its own change, not an accident. And the migration is spread across the stage 3 PRs, one per domain:
reverting it means reverting the whole stage.

## Alternatives considered

- Keeping the BFF and migrating only some domains. Discarded: that is the double path [#38] describes
  as debt; half migrated and half not is the worst combination.
- A data module per domain (`insforge-functions.ts`) between the page and the SDK. Discarded for now:
  it adds a layer that is not needed today. The third use of the same `select`/mapping remains the
  trigger (point 3).
- Aggregating on the server (moving the browser's aggregation into the handler). Discarded: there is
  no server-side aggregation today and adding it brings back the endpoint and the extra auth call. If
  it is ever needed, it is reopened with a new ADR.

## Status

Accepted. Note that the table in "Endpoints that survive" is out of date: `src/app/api/` no longer exists
in this repository, so those server routes are gone and the data path is client-only.


[#38]: https://github.com/PabloJustDevelops/TravelPal/issues/38
[#53]: https://github.com/PabloJustDevelops/TravelPal/issues/53
[#56]: https://github.com/PabloJustDevelops/TravelPal/issues/56
