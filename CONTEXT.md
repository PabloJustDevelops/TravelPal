# Context

## What this is

TravelPal (repo `PabloJustDevelops/TravelPal`): web app for planning trips — itineraries, expenses,
budgets, notes, tasks, bookings, alerts and analytics.

## Stack

- **Framework**: Next.js 16.3.8 (App Router) + React 19 + TypeScript.
- **Backend**: InsForge (Postgres + Auth + Storage) through `@insforge/sdk` from the browser.
- **Hosting**: static Next.js export (`out/`) served by Cloudflare Workers Assets with Wrangler
  (see ADR-014; ADR-003 describes the earlier OpenNext stage).
- **Tests**: Jest + Testing Library. **Lint**: ESLint. **Commits**: Conventional Commits.

## Commands

```bash
pnpm run dev          # Next dev
pnpm run lint         # ESLint
pnpm run type-check   # tsc --noEmit
pnpm run test:ci      # Jest (CI)
pnpm run test:e2e     # Playwright E2E (see docs/TESTING.md)
pnpm run build        # next build produces the static export in out/
pnpm run preview      # wrangler dev; serves the out/ already built
pnpm run deploy       # rebuild, validate the export, publish it with Wrangler
```

## Data model — single source of truth

`migrations/20260913181842_create-app-schema.sql`. There is no other SQL: the rest was deleted for
contradicting it (see ADR-004). The base migration was also cleaned when `reminders` and
`calendar_events` were removed, tables that never existed in the backend (see
`docs/audits/auditoria-utilidad-y-rework.md`). The schema derives from the real queries; if the
TypeScript model changes, the migration must be updated.

Tables: `trips`, `expenses`, `notes`, `tasks`, `bookings`, `itinerary_activities`, `alerts`,
`budgets`, `profiles`. Later migrations add `journal_entries`, `journal_photos` and
`push_subscriptions`.

Rules: `text + CHECK` instead of enums; FKs only when a query uses them; owner RLS with
`auth.uid()` on every table with `user_id` (and by `id` in `profiles`).

## Glossary

- **Trip**: a user's trip (origin, destination, dates, status).
- **Expense**: a spend, optionally linked to a Trip.
- **Budget**: per-Trip or general budget, with `total_amount` and `spent_amount`.
- **Booking**: a reservation for a Trip (flight, hotel, car, activity, restaurant, other).
- **ItineraryActivity**: a dated activity inside a Trip.
- **Note**: a user note, optionally linked to a Trip.
- **JournalEntry**: an entry in a Trip's journal (date, free text and a rating from 1 to 5). It is
  the post-trip memory; different from a Note, which is global.
- **Task**: a task with status and priority.
- **Alert**: a notice shown in the notification bell.
- **Profile**: the user's public data (`profiles`); identity lives in `auth.users`.

## Where to look

- `DESIGN.md`: current Atlas direction, actual UI tooling, per-module status and continuity for other chats.
- `AGENTS.md`: rules for agents (issue tracker, triage labels, skills, hosting).
- `docs/ARCHITECTURE.md`: technical vision and data flow.
- `docs/DECISIONS/`: ADRs (000 template; 001 obsolete; 002 InsForge; 003 OpenNext retired;
  004 schema; 014 static assets Worker).
- `docs/agents/`: how to consume `CONTEXT.md`/ADRs, issue tracker and triage labels.

## Rules

- If a doc and the code contradict each other, **the code wins** and the doc is corrected or deleted.
- Never commit keys; values live in `.env.local` (ignored by git).
- Do not use Postgres enums; use `text + CHECK` aligned with the TypeScript unions.
