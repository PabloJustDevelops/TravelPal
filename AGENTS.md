## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in this repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, label strings unchanged (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root, ADRs in `docs/DECISIONS/`. See `docs/agents/domain.md`.

### Hooks de git

`.githooks/commit-msg` borra la atribución `Co-authored-by: CommandCodeBot` que el CLI de Command Code
añade a los commits que crea: ese trailer metía al bot como contribuidor del repo. Actívalo en cada clon
con `git config core.hooksPath .githooks` (no se activa solo). Cualquier otro `Co-authored-by` se respeta.

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

La producción es un export estático de Next.js (`output: "export"`) en `out/`, servido como
assets-only Worker de Wrangler según `wrangler.jsonc`. Cloudflare no ejecuta un servidor Next.js
ni un entrypoint de aplicación. `@opennextjs/cloudflare` sigue declarado como dependencia de
desarrollo, pero no participa en la compilación ni publicación de producción. Vercel queda retirado
del repo y ya está desconectado de este repositorio: no hay ninguna integración de Vercel pendiente.

Los triggers de Cloudflare Workers Builds se retiraron a proposito: el unico camino de deploy es
el trabajo `deploy` de `.github/workflows/ci.yml`, no los vuelvas a crear.

### Despliegue automatico (GitHub Actions)

El despliegue lo hace el trabajo `deploy` de `.github/workflows/ci.yml`, solo al empujar a `main`
(nunca en pull requests), con Node 22.22.3. `build` ejecuta lint, type-check, Jest, la prueba RLS,
timezone, el guardián de rutas de datos, `pnpm run build` (que genera `out/`), el validador del
export y Storybook; luego sube `out/` como artefacto. `worker` descarga ese mismo artefacto, lo
valida y ejecuta `pnpm exec wrangler deploy --dry-run --no-autoconfig`. `e2e` prueba el artefacto
antes del despliegue. `deploy` depende de esos tres trabajos, descarga el artefacto validado y lo
publica con `pnpm exec wrangler deploy --no-autoconfig`; después, `e2e-produccion` vuelve a probar
la URL desplegada.

El build usa `NEXT_PUBLIC_INSFORGE_URL` y `NEXT_PUBLIC_INSFORGE_ANON_KEY`. La publicación usa el
secreto `CLOUDFLARE_API_TOKEN`; `CLOUDFLARE_ACCOUNT_ID` va literal en el workflow, no es un
secreto. El Worker estático no recibe `INSFORGE_API_KEY` ni secretos de runtime.

No hace falta configurar Workers Builds a mano en el dashboard: GitHub Actions es la única vía
automática de deploy. Para probar localmente, ejecuta `pnpm run build`,
`pnpm run validate:static-export` y después `pnpm run preview`; `preview` solo ejecuta
`wrangler dev` y requiere que `out/` ya exista. Manual, si hiciera falta, `pnpm run deploy`
reconstruye el export, lo valida y ejecuta `wrangler deploy --no-autoconfig` con Wrangler autenticado.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
