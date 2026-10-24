# ADR-002: InsForge backend instead of Supabase

## Context

The app was built on Supabase (Postgres, Auth, Storage). The Supabase project was retired and its
build failed in CI; the data layer also used Supabase's shape (`client.from(...)`,
`auth.getSession()`, `@supabase/ssr`), coupled to that platform.

## Decision

Migrate the backend to InsForge (`@insforge/sdk`), keeping Postgres as the database:

- Data: `createClient({ baseUrl, anonKey })` and access through `client.database.from(...)`.
- Server session: `@insforge/sdk/ssr` with `createServerClient({ cookies })`, `updateSession()`
  in the proxy (`src/proxy.ts`) and the `/api/auth/refresh` route with `createRefreshAuthRouter()`.
- Auth: server mutations with `createAuthActions` (the refresh token is httpOnly).
- Admin: `createAdminClient({ apiKey })` in server code.
- `@supabase/supabase-js`, `@supabase/ssr` and `@supabase/auth-ui-*` are removed.

## Consequences

- The SDK exposes neither `getSession()` nor `updateUser()`: `requireUser()` uses
  `getCurrentUser()` and password reset uses InsForge's token flow.
- InsForge does not accept Postgres enums defined by hand in the repo: the schema uses
  `text + CHECK`.
- Credentials live in `.env.local` (`NEXT_PUBLIC_INSFORGE_URL`,
  `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY`); none of them is versioned.
- The schema is replicated in InsForge with `db migrations` (see ADR-004).

## Status

Accepted
