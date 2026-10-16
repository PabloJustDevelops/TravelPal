# ADR-014: Publicar el export estático como Cloudflare Worker de assets

## Contexto

El límite de CPU del plan Free de Cloudflare no permite ejecutar de forma fiable un servidor Next.js
en un Worker. La aplicación ya puede compilarse como export estático (`output: "export"`) y la
autenticación y el acceso a datos funcionan desde el navegador con el SDK de InsForge. El Worker de
producción solo necesita servir los archivos exportados.

## Decisión

- Next.js genera el sitio estático en `out/`; el workflow y el script local verifican el export con
  `pnpm run validate:static-export`.
- `wrangler.jsonc` declara únicamente `assets.directory: "./out"` y no configura un entrypoint de
  aplicación. Wrangler publica un Worker de assets estáticos, sin servidor Next.js ni lógica de
  aplicación ejecutada en CPU del Worker.
- GitHub Actions es la única vía automática de publicación. En push a `main`, el job `build` corre
  lint, type-check, Jest, la prueba RLS, timezone, la comprobación de caminos de datos, el build
  estático y Storybook; valida y sube `out/`. El job `worker` descarga el mismo artefacto, lo vuelve
  a validar y ejecuta `wrangler deploy --dry-run --no-autoconfig`. El E2E predeploy prueba el export.
  `deploy` depende de `build`, `worker` y `e2e`, descarga ese artefacto y ejecuta
  `wrangler deploy --no-autoconfig`; `e2e-produccion` comprueba el sitio después de publicarlo.
- No se configuran Cloudflare Workers Builds. Los triggers de ese servicio se retiraron; no deben
  volver a crearse.
- `pnpm run preview` ejecuta solo `wrangler dev` y sirve el contenido de `out/` ya generado. Para
  generar y comprobarlo localmente se ejecuta `pnpm run build` y `pnpm run validate:static-export`
  antes de `pnpm run preview`.
- `pnpm run deploy` ejecuta `pnpm run build`, valida el export y luego
  `wrangler deploy --no-autoconfig`. `pnpm run upload` repite build y validación y llama a Wrangler
  con `--dry-run`; no publica cambios.
- `@opennextjs/cloudflare` y `open-next.config.ts` permanecen en el repositorio, pero no forman
  parte de los scripts ni del workflow de producción.

## Consecuencias

- El Worker no ejecuta SSR, Route Handlers ni Server Actions de Next.js. Las rutas de la app se
  exportan como archivos estáticos y las operaciones de usuario se realizan desde el navegador
  contra InsForge; RLS sigue siendo la frontera de autorización de datos.
- Las variables `NEXT_PUBLIC_INSFORGE_URL` y `NEXT_PUBLIC_INSFORGE_ANON_KEY` se incorporan durante
  el build. La publicación solo necesita `CLOUDFLARE_API_TOKEN` y el `CLOUDFLARE_ACCOUNT_ID` del
  workflow; no se configura `INSFORGE_API_KEY` como secreto del Worker.
- El job `worker` y el E2E predeploy son gates antes de publicar. `e2e-produccion` es una
  comprobación posterior al deploy y confirma que el artefacto sirve correctamente bajo la URL de
  producción.
- La vista previa local requiere un `out/` reciente; `pnpm run preview` no lo construye.

## Estado

Aprobado y en producción. Sustituye ADR-003.
