# Technical documentation

> Technical guide and configuration for TravelPal (repo `PabloJustDevelops/TravelPal`).

For domain context and the data model, see [CONTEXT.md](../CONTEXT.md). For the architecture,
[ARCHITECTURE.md](./ARCHITECTURE.md). For decisions, [DECISIONS/](./DECISIONS/).

## Requirements

| Component | Version | Description |
|------------|---------|-------------|
| Node.js | 22.22.3+ or 24.8+ | CI pins 22.22.3; required by Tester Army |
| pnpm | 12.3.4 | Package manager (repo with `pnpm-lock.yaml`) |
| InsForge project | - | Postgres + Auth + Storage |

## Main dependencies

- `next` ^16.3.8, `react`/`react-dom` 19.1.0
- `@insforge/sdk` ^1.5.2 (data, auth, storage)
- `wrangler` ^4.125.0 to serve and publish the static export on Cloudflare Workers Assets
- `@opennextjs/cloudflare` remains as a legacy development/configuration dependency, but takes no
  part in `build`, `preview` or the current publish
- `typescript` ^5, `eslint` ^9, `jest` ^29.7.0 + Testing Library
- `storybook` 10.6.3, `vitest` 4.1.11 (Storybook only), `@playwright/test` ^1.63.0

Check `package.json` for the exact versions.

## Installation

```bash
git clone https://github.com/PabloJustDevelops/TravelPal.git
cd TravelPal
pnpm install --frozen-lockfile
cp .env.example .env.local   # and fill in the values
pnpm run dev
```

The app is served at `http://localhost:3000`.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Development server (`next dev --turbopack`) |
| `pnpm run lint` | ESLint |
| `pnpm run type-check` | `tsc --noEmit` |
| `pnpm run test:ci` | Jest (CI) |
| `pnpm run test:e2e` | Playwright: flows with data |
| `pnpm run test:tester` | Tester Army: public access in two viewports |
| `pnpm run build` | `node scripts/build-seo.mjs && next build && node scripts/build-security-headers.mjs`; `next.config.js` exports the static site to `out/` |
| `pnpm run validate:static-export` | Checks the export's critical routes and assets, and that it carries no private keys |
| `pnpm run check:headers` | Checks the effective CSP, inline hashes and the seven global headers in `out/_headers` |
| `pnpm run preview` | `wrangler dev`; serves the existing `out/`, does not build it |
| `pnpm run deploy` | Runs build, validation and `wrangler deploy --no-autoconfig` |
| `pnpm run upload` | Runs build, validation and the Wrangler dry-run; does not publish |

For a local preview, run `pnpm run build`, `pnpm run validate:static-export` and then
`pnpm run preview`. The `wrangler.jsonc` configuration only points the assets binding at the `out/`
directory; it defines no application entrypoint.

### Security headers

`public/_headers` holds the base policy and HSTS. After `next build`,
`scripts/build-security-headers.mjs` adds to `out/_headers` the SHA-256 hashes of every inline script
in the exported HTML (theme and hydration included). `unsafe-inline` and `unsafe-eval` are not allowed
for scripts; Zod uses `jitless` in `src/lib/public-env.ts` to avoid dynamic code generation.
`style-src` allows inline styles and `img-src https:` keeps avatars with external URLs working.
`data:` and `blob:` are not enabled for resources without a use that needs them.

The generator loads the environment with `@next/env` in production mode, like Next: it considers
`.env.production.local`, `.env.local`, `.env.production` and `.env`, and expands references between
variables. Variables already exported keep priority. That way `connect-src` uses the same
`NEXT_PUBLIC_INSFORGE_URL` value as the compiled client. Without the variable it uses the production
host declared in the template. As a result the test build with `https://example.invalid` does not
alter the production policy and needs no permanent test exceptions.

After building, run `pnpm run check:headers`. It fails if a global header is missing, if the CSP goes
back to Report-Only, if it allows arbitrary scripts, if hashes for the current HTML are missing, or if
a line exceeds the 2,000 characters Cloudflare accepts. If the site grows to that limit, the policy
will have to be split by route; it does not degrade to `unsafe-inline` automatically. Do not publish
the unprocessed `_headers` from `public/`: always use the `out/` from a full build.

To check it in a browser without a real backend:

```bash
pnpm exec wrangler dev --ip 127.0.0.1 --port 8791 --inspector-port 9291
# In another terminal, with Playwright's Chromium installed:
node scripts/test-security-csp.mjs http://127.0.0.1:8791
```

The test collects console output, failed requests and `securitypolicyviolation` events on `/`,
`/signin`, `/travel-inspiration` and `/dashboard`; it also checks form validation to confirm
hydration. With the dummy backend, DNS errors are expected, not CSP violations.
The initial report and its limitations are in [cabeceras-2026-10-20.md](security/cabeceras-2026-10-20.md).

## Environment variables

`.env.local` (never committed):

```bash
# InsForge (required)
NEXT_PUBLIC_INSFORGE_URL=https://<appkey>.<region>.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<anon key>

# Required by the environment validation of pnpm run dev; not included in the export
INSFORGE_API_KEY=<api key>

# Logging (optional): debug | info | warn | error
NEXT_PUBLIC_LOG_LEVEL=info

```

`NEXT_PUBLIC_*` values are embedded in the export during the build. `pnpm run dev` loads
`src/lib/env.ts` through `src/instrumentation.ts`, so it requires `INSFORGE_API_KEY`; the static build
and the Worker neither need it nor receive it. The CI publish uses `CLOUDFLARE_API_TOKEN`; the build
receives only the two public InsForge variables.

## Structure

```
src/
├── app/                    # App Router: pages exportable as static files
├── components/             # UI by domain + base ui/
├── contexts/               # AuthContext, ThemeContext
└── lib/
    ├── insforge.ts         # Browser client (createInsforgeClient)
    ├── auth.ts             # AuthService
    ├── public-env.ts       # Public variable validation
    └── env.ts              # Secret validation for local administrative utilities
migrations/                 # InsForge schema (source of truth)
```

## Testing and quality

- Jest + React Testing Library; tests in `__tests__/` or `*.test.ts(x)`.
- Configuration: `jest.config.js`, `jest.setup.js`.
- ESLint: `eslint.config.mjs`.
- CI: `.github/workflows/ci.yml` (lint, type-check, tests, static export, validation and Wrangler dry-run).

On a PR, `build` validates the export and uploads `out/` as an artifact; `worker` downloads that same
artifact, validates it and runs `wrangler deploy --dry-run --no-autoconfig`; `e2e` tests the export
before deploy. On pushes to `main`, `deploy` waits for those three gates and publishes the artifact
with `wrangler deploy --no-autoconfig`. `e2e-produccion` runs the suites again after publishing.
Cloudflare Workers Builds is not used: GitHub Actions is the only publish path.

## Troubleshooting

### Dependency installation error
```bash
pnpm install --frozen-lockfile
```

### Environment variable error
- Check that `.env.local` exists and holds the right values.
- Restart the development server after changing variables.

### Wrangler cannot serve the preview
- Check that `out/` exists and is recent: `pnpm run preview` does not build the site.
- Run `pnpm run build` and `pnpm run validate:static-export`, then start `pnpm run preview` again.
- To publish manually, authenticate Wrangler and run `pnpm run deploy`.
