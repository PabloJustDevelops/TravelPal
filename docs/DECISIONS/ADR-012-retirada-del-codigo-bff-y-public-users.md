# ADR-012: Removal of the BFF code and of `public.users`

## Context

ADR-009 left `requireUser`, `ensureUserExists` and `useApiResource` without callers as stage 4
cleanup of #38; that stage was spent on #53 and #56. `public.users` was only written by
`ensureUserExists`; in production it has 0 rows and 0 incoming FKs; `profiles` is the real profile.

Measured effect of #38 on the Worker (deploy job, `Total Upload` line): from 13864.67 KiB / 2843.16
KiB gzip (main @3b84755, before stage 0) to 13258.90 KiB / 2755.23 KiB gzip (main @96d909f, stage 4):
−605.77 KiB (−4.4 %) and −87.93 KiB gzip (−3.1 %).

## Decision

1. Delete the functions/types/hook and their tests; `createServerInsforgeClient` is kept because
   `auth-actions.ts` uses it.
2. The guard still watches `useApiResource(` as a fence.
3. `public.users` leaves the model with migration `20260918210000_drop-public-users.sql`, applied on
   2026-10-02 with human approval (previous backup `antes-de-drop-users`): the table no longer exists
   in the backend and its 3 RLS policies went with it; until then the empty table broke nothing.
4. Docs aligned (ARCHITECTURE, TECHNICAL, CONTEXT, ADR-002).

## Consequences

Less surface; the `CONTEXT.md` model matches the backend. Discarded alternative: keeping the table
"just in case" (it keeps 3 RLS policies that the advisor counts as debt and a doc that lies).

## Status

Accepted and applied. The migration ran on 2026-10-02 against the InsForge backend, with a previous
backup (`antes-de-drop-users`) and a later verification: `to_regclass('public.users')` returns null,
the 3 `users_*_own` policies are gone and the migration is recorded in `system.custom_migrations`.
