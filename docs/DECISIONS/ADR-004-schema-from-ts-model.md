# ADR-004: The schema is derived from the app's TypeScript model

## Context

The `.sql` files in the repo came from the Supabase stage and were not a usable source of truth:
`supabase-schema.sql` warned that it "is not meant to be executed" and used a `trip_status` enum
that no file defines; `src/lib/supabase-schema.sql` created foreign keys to `trips(id)` without
creating `trips`; `create_profiles_table.sql` used `raw_user_meta_data` (a Supabase column) and
touched the `auth` schema. The app's real schema lived in the TypeScript model and in the queries
of the API routes and pages.

## Decision

Derive the schema from the real queries (types in `src/lib` + API routes + pages) and keep it in
a single source of truth: `migrations/20260913181842_create-app-schema.sql`.

- `text + CHECK` instead of Postgres enums (it matches the TS string unions and avoids the
  undefined enum).
- FKs only where a query uses them (`auth.users(id)`, `trips(id)`, and so on).
- Owner RLS with `auth.uid()` on every table with `user_id` (and by `id` in `users`/`profiles`).
- Indexes only for real filters and orderings; `updated_at` with `system.update_updated_at()`.
- Avatars are Storage: the bucket is created with the CLI, not with DDL.
- The contradicting Supabase `.sql` files are deleted (they remain in git history).

## Consequences

- A schema change is made with `db migrations new` + `up`, not by editing loose SQL.
- If the TS model changes, the migration must reflect it; code rules over documentation.
- With no enums, valid values are enforced by `CHECK` and by the TS types.

## Status

Accepted
