## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in this repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, label strings unchanged (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root, ADRs in `docs/DECISIONS/`. See `docs/agents/domain.md`.

### Git hooks

`.githooks/commit-msg` strips the `Co-authored-by: CommandCodeBot` trailer that the Command Code CLI
adds to every commit it creates; that trailer was listing the bot as a repository contributor. Enable it
per clone with `git config core.hooksPath .githooks` (it is not enabled automatically). Any other
`Co-authored-by` line is preserved.

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **travelpal** (API base `https://sjdq7zsn.eu-central.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->

## Hosting

Production is a static Next.js export (`output: "export"`) written to `out/` and served as an
assets-only Wrangler Worker configured in `wrangler.jsonc`. Cloudflare runs neither a Next.js server nor
any application entrypoint. `@opennextjs/cloudflare` remains in devDependencies but takes no part in the
production build or publish. Vercel is retired from this repository and no Vercel integration is
pending.

Cloudflare Workers Builds triggers were removed on purpose: the only deploy path is the `deploy` job in
`.github/workflows/ci.yml`. Do not recreate them.

### Automated deploy (GitHub Actions)

The `deploy` job in `.github/workflows/ci.yml` publishes on pushes to `main` only, never on pull
requests, with Node 22.22.3.

`build` runs lint, type-check, Jest, the RLS test, the timezone test, the data-route guard,
`pnpm run build` (which produces `out/`), the export validator and Storybook, then uploads `out/` as an
artifact. `worker` (displayed as `worker-build`) downloads that artifact, validates it and runs
`pnpm exec wrangler deploy --dry-run --no-autoconfig`. `e2e` tests the artifact before deploy. `deploy`
depends on those three, downloads the validated artifact and publishes it with
`pnpm exec wrangler deploy --no-autoconfig`; afterwards `e2e-produccion` tests the deployed URL.

The build reads `NEXT_PUBLIC_INSFORGE_URL` and `NEXT_PUBLIC_INSFORGE_ANON_KEY`. Publishing uses the
`CLOUDFLARE_API_TOKEN` secret; `CLOUDFLARE_ACCOUNT_ID` is written literally in the workflow and is not a
secret. The static Worker receives neither `INSFORGE_API_KEY` nor runtime secrets.

Workers Builds needs no manual setup in the dashboard: GitHub Actions is the only automated deploy path.
To test locally, run `pnpm run build`, `pnpm run validate:static-export` and then `pnpm run preview`;
`preview` only starts `wrangler dev` and requires `out/` to exist already. If you ever need a manual
deploy, `pnpm run deploy` rebuilds the export, validates it and runs `wrangler deploy --no-autoconfig`
with an authenticated Wrangler.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
