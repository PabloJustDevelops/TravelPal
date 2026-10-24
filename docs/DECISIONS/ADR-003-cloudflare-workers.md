# ADR-003: Cloudflare Workers hosting with OpenNext (retired)

## Context

Deployment ran on Vercel. Hosting moves to Cloudflare Workers through the official adapter
`@opennextjs/cloudflare`. The app uses Next.js 16; the older route, `@cloudflare/next-on-pages`,
only covers Next <= 15.5.2, so it is discarded.

## Decision

- Adopt `@opennextjs/cloudflare` (devDependency) with `wrangler` and `rclone.js`.
- Config: `open-next.config.ts`, `wrangler.jsonc` (`nodejs_compat` +
  `global_fetch_strictly_public`), `public/_headers` and a local, ignored `.dev.vars`.
- Scripts: `preview`, `deploy`, `upload` (OpenNext build + wrangler) and `cf-typegen`.
- Remove Vercel from the repo: `vercel.json` and the `.vercel` entries in `.gitignore` are gone.
  Disconnecting the Vercel integration from the repo is a dashboard action (Pablo's login).

## Consequences

- `build` stays `next build`; the adapter invokes it and then generates `.open-next/worker.js`.
- `experimental.optimizeCss` was removed: it made the adapter look for
  `.next/standalone/.next/static/css`, which Next 16 no longer generates.
- `NEXT_PUBLIC_*` are inlined at build time; only `INSFORGE_API_KEY` is a runtime secret
  (`wrangler secret put`).
- CI adds a `worker-build` job (`npx opennextjs-cloudflare build`, no deploy).

## Status

Retired and superseded by [ADR-014](ADR-014-cloudflare-static-assets-worker.md). This ADR is kept
as a record of the previous decision; its build and deploy instructions no longer describe the
current configuration.
