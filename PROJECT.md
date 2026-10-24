# PROJECT.md: TravelPal

## Objective

TravelPal is a web application to plan, book and track trips —itineraries, tasks, notes, expenses and
budgets— built with Next.js as a static export served by Cloudflare Workers, with InsForge as the
backend (Postgres, Auth, Storage and edge functions).

## Scope

### Included

- **Account**: sign-up, sign-in, password recovery, profile and theme (InsForge auth; the session travels
  in an httpOnly cookie managed by the SDK).
- **Trips** (`trips`) and their detail view.
- **Planning**: bookings (`bookings`, including a flight as a manual booking of type `flight`) and
  itinerary activities (`itinerary_activities`).
- **Expenses** (`expenses`) and budgets (`budgets`, folded into the expenses view).
- **Dashboard** (`/dashboard`).
- **Travel journal** (`journal_entries`, with private photos served through signed URLs).
- **Notes** (`notes`) and tasks (`tasks`).
- **Alerts** in the notification bell, derived from tasks, bookings and budgets; the bell reads and marks
  them as read.
- **Public landing page**.
- **Browser push**: subscription management in the client plus the `send-push` InsForge function.
- **Flight inspiration**: price ideas from Travelpayouts through the `travel-inspiration` InsForge
  function.

### Excluded

- **Live flight search**: Amadeus was removed; flights are entered by hand (ADR-006).
- **Assistant/chatbot**: fully removed, including its LLM proxy (ADR-008).
- **Server push delivery beyond InsForge**: the sending path is the `send-push` function; there is no
  other server (ADR-013).
- **Vercel**: hosting removed; the only path is Cloudflare Workers (ADR-003).
- **Functional rework proposed in `docs/audits/auditoria-utilidad-y-rework.md`**: not applied.
- **Roadmap** (see `README.md`): i18n, more travel APIs, collaboration and a native app. Future work,
  outside the current scope.

## Definition of done

A change is done when, on `main`:

- [ ] `pnpm run lint`, `pnpm run type-check`, `pnpm run test:ci` and `pnpm run build` pass, and CI
      (`.github/workflows/ci.yml`) is green, including the `worker-build` job (wrangler dry-run over the
      exported artifact).
- [ ] `node scripts/check-data-paths.mjs` passes: no new data path through the removed BFF (single data
      path, ADR-009).
- [ ] The `deploy` job (push to `main`) publishes the static Worker with
      `wrangler deploy --no-autoconfig`, and `e2e-produccion` passes against the deployed URL.
- [ ] The schema deployed in InsForge matches `migrations/` (every migration applied).
- [ ] The feature works end to end in production and per-user isolation is enforced by RLS
      (`auth.uid()`), not by a handler.
- [ ] Documentation that contradicts the code is corrected or deleted (code wins; rule from
      `CONTEXT.md`).
- [ ] If the decision changes scope or the data model, it carries its ADR in `docs/DECISIONS/`.

## References

- **Glossary and data model**: [`CONTEXT.md`](CONTEXT.md).
- **Decisions (ADRs)**: [`docs/DECISIONS/`](docs/DECISIONS/) — 000 template; 001 obsolete; 002 InsForge;
  003 Cloudflare Workers; 004 schema from the TS model; 005 secrets not inlined; 006 flights as manual
  entry; 007 visual direction; 008 assistant removal; 009 single data path through the SDK; 010
  per-operation persistence in the planner; 011 private journal photos; 012 removal of the BFF code and
  `public.users`; 013 browser push with delivery in InsForge; 014 static assets Worker; 015 travel
  inspiration in InsForge.
- **Issues and specs (tracker)**: GitHub issues of this repo, through the `gh` CLI
  ([`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)).
- **Architecture and technical guide**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
  [`docs/TECHNICAL.md`](docs/TECHNICAL.md).
