# ADR-003: Hosting en Cloudflare Workers con OpenNext (retirado)

## Contexto

El despliegue se hacía en Vercel. Se decide pasar el hosting a Cloudflare Workers usando el
adaptador oficial `@opennextjs/cloudflare`. La app usa Next.js 16; la vía antigua
`@cloudflare/next-on-pages` solo cubre Next <= 15.5.2, así que se descarta.

## Decisión

- Adoptar `@opennextjs/cloudflare` (devDependency) con `wrangler` y `rclone.js`.
- Config: `open-next.config.ts`, `wrangler.jsonc` (`nodejs_compat` +
  `global_fetch_strictly_public`), `public/_headers` y `.dev.vars` local (ignorado).
- Scripts: `preview`, `deploy`, `upload` (build de OpenNext + wrangler) y `cf-typegen`.
- Retirar Vercel del repo: fuera `vercel.json` y las entradas `.vercel` del `.gitignore`.
  Desconectar la integración de Vercel con el repo es una acción de dashboard (login de Pablo).

## Consecuencias

- `build` sigue siendo `next build`; el adaptador lo invoca y luego genera `.open-next/worker.js`.
- Se quitó `experimental.optimizeCss`: hacía que el adaptador buscara
  `.next/standalone/.next/static/css`, que Next 16 ya no genera.
- `NEXT_PUBLIC_*` se inlinean en build; solo `INSFORGE_API_KEY` es secreto de runtime
  (`wrangler secret put`).
- El CI añade un job `worker-build` (`npx opennextjs-cloudflare build`, sin deploy).

## Estado

Retirado y sustituido por [ADR-014](ADR-014-cloudflare-static-assets-worker.md). Este ADR se
conserva como registro de la decisión anterior; sus instrucciones de build y deploy ya no describen
la configuración vigente.
