# ADR-014: Publishing the static export as a Cloudflare assets Worker

## Context

The Free plan's CPU limit on Cloudflare does not allow running a Next.js server reliably in a Worker.
The application can already build as a static export (`output: "export"`) and authentication and data
access work from the browser with the InsForge SDK. The production Worker only needs to serve the
exported files.

## Decision

- Next.js generates the static site into `out/`; the workflow and the local script verify the export
  with `pnpm run validate:static-export`.
- `wrangler.jsonc` declares only `assets.directory: "./out"` and configures no application entrypoint.
  Wrangler publishes a static assets Worker, with no Next.js server and no application logic running
  on Worker CPU.
- GitHub Actions is the only automatic publication path. On a push to `main`, the `build` job runs
  lint, type-check, Jest, the RLS test, timezone, the data-paths check, the static build and
  Storybook; it validates and uploads `out/`. The `worker` job downloads that same artifact, validates
  it again and runs `wrangler deploy --dry-run --no-autoconfig`. The pre-deploy E2E tests the export.
  `deploy` depends on `build`, `worker` and `e2e`, downloads that artifact and runs
  `wrangler deploy --no-autoconfig`; `e2e-produccion` checks the site after publication.
- Cloudflare Workers Builds is not configured. That service's triggers were removed; they must not be
  created again.
- `pnpm run preview` runs only `wrangler dev` and serves the content of an already generated `out/`.
  To generate and check it locally, run `pnpm run build` and `pnpm run validate:static-export` before
  `pnpm run preview`.
- `pnpm run deploy` runs `pnpm run build`, validates the export and then
  `wrangler deploy --no-autoconfig`. `pnpm run upload` repeats the build and validation and calls
  Wrangler with `--dry-run`; it publishes no changes.
- `@opennextjs/cloudflare` and `open-next.config.ts` stay in the repository, but they are not part of
  the scripts or the production workflow.

## Consequences

- The Worker runs no SSR, Route Handlers or Server Actions from Next.js. The app's routes are exported
  as static files and user operations are performed from the browser against InsForge; RLS remains the
  data authorisation boundary.
- `NEXT_PUBLIC_INSFORGE_URL` and `NEXT_PUBLIC_INSFORGE_ANON_KEY` are inlined during the build.
  Publication only needs `CLOUDFLARE_API_TOKEN` and the workflow's `CLOUDFLARE_ACCOUNT_ID`;
  `INSFORGE_API_KEY` is not configured as a Worker secret.
- The `worker` job and the pre-deploy E2E are gates before publishing. `e2e-produccion` is a
  post-deploy check and confirms that the artifact is served correctly under the production URL.
- Local preview requires a recent `out/`; `pnpm run preview` does not build it.

## Status

Accepted and in production. It supersedes ADR-003.
