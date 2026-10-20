# Cabeceras de seguridad — 2026-10-20

Rama `chore/seguridad-csp`, base `9f1abffa6d0b6b82c194baa5778c0968b99ef91a`.
Solo este worktree. Sin push, PR ni deploy. Node v24.20.0, pnpm 12.3.4,
Next 16.3.8, Wrangler 4.125.0. Las pruebas usan un export con URL pública ficticia;
no verifican datos ni una sesión real de InsForge.

## Inventario de orígenes en src/

| Origen/recurso | Referencia | Uso y efecto en CSP |
|---|---|---|
| `https://sjdq7zsn.eu-central.insforge.app` en producción; `NEXT_PUBLIC_INSFORGE_URL` configurable | `src/lib/public-env.ts:36`, `src/lib/insforge.ts:12` | API del SDK para auth, database y storage: `connect-src`. El generador adapta el origen al entorno del build. |
| Google OAuth vía InsForge, proveedor `google` | `src/lib/auth.ts:105` | El SDK inicia OAuth con retorno al mismo origen `/auth/callback`. Se permite InsForge y `https://accounts.google.com` en `form-action` por compatibilidad con el flujo; no hay iframe ni script remoto de Google. No se añade Google a `connect-src`. |
| `https://fonts.googleapis.com`, `https://fonts.gstatic.com` | `src/app/layout.tsx:2`, `:45`, `:46` | Inter/Fraunces mediante `next/font/google` y dos preconnect. Las fuentes se descargan en build y se sirven desde `/_next/static/`; el navegador probado no necesita abrir estos orígenes en `font-src` ni en `style-src`. |
| `https://www.aviasales.com/search/...` | `src/components/trips/FlightInspiration.tsx:35` | Enlace externo de navegación, no fetch ni recurso embebido. No requiere apertura en CSP. |
| URL arbitraria de avatar (incluido avatar OAuth) | `src/app/profile/page.tsx:195`, `src/components/layout/Navbar.tsx:109`, `:221`, `src/lib/auth.ts:194` | El formulario admite URL externa y Navbar la usa en `<img>`. Se admite `https:` en `img-src`; una lista fija de hosts rompería esta funcionalidad. No se permite HTTP inseguro. |
| URLs de Storage, upload de avatar y fotos firmadas del diario | `src/lib/auth.ts:238`, `src/components/trips/JournalPhotos.tsx:74`, `:129`, `:271` | Llamadas SDK a InsForge y `<img src={signedUrl}>`; cubiertas por el origen API y `img-src https:`. No se consultó un backend real para inventar un dominio alternativo de Storage. |
| `/brand/travelpal-mark.svg` | `src/components/landing/Brand.tsx:10`, `src/components/layout/Navbar.tsx:58` | Máscara SVG del mismo origen, cubierta por `img-src 'self'`. Los estilos inline requieren `style-src 'unsafe-inline'`. |
| `/images/atlas/...`, `/images/atlas/google.svg` | `src/components/landing/Hero.tsx:30`, `src/components/landing/Features.tsx:15`, `src/components/auth/AuthShell.tsx:23`, `src/components/auth/GoogleButton.tsx:44` | Imágenes del mismo origen. |
| `blob:` para descarga JSON | `src/app/dashboard/page.tsx:323` | `URL.createObjectURL(blob)` y enlace `download`, no imagen ni script; no justifica `blob:` en las directivas de recursos. |
| `data:` | Búsqueda de literales y consumidores en `src/` | No se encontraron URLs data usadas como recursos. No se habilita. |

Se recorrieron también tests/stories: no se usaron sus fixtures como permisos para producción.
No hay consumidores de realtime/WebSocket/EventSource en `src/`; no se habilita `wss:`.
`next.config.js` conserva remotePatterns de Unsplash y placeholder, pero no hay consumidores
de esas imágenes en `src/` que justifiquen permisos específicos adicionales.
El comentario heredado en `src/lib/insforge/oauth.ts` sobre una Server Action no describe el
flujo actual: no hay route handlers ni se añadieron en este encargo.

## Política final

La plantilla vive en `public/_headers`. `pnpm run build` ejecuta `next build` y después
`scripts/build-security-headers.mjs`, que recorre todos los HTML del export y escribe
`out/_headers` con hashes SHA-256 de los scripts inline exactos. Se obtuvieron 22 hashes únicos.
El máximo medido en este artefacto es 1.537 caracteres por línea, inferior al límite de 2.000.
Los hashes cambian con cada build; no se fijan hashes manuales ni nonces estáticos.

| Directiva | Valor final y justificación |
|---|---|
| `default-src` | `'self'`: cierre por defecto. |
| `script-src` | `'self'` y hashes SHA-256 generados: scripts propios, tema e hidratación. Sin `unsafe-inline` ni `unsafe-eval`. |
| `style-src` | `'self' 'unsafe-inline'`: CSS local y estilos inline existentes, incluidas máscaras y estilos dinámicos. |
| `img-src` | `'self' https:`: marca/assets locales, fotos firmadas y avatares externos configurables. Es una apertura deliberada a imágenes HTTPS, no a scripts. |
| `connect-src` | `'self'` y origen de `NEXT_PUBLIC_INSFORGE_URL`: producción usa `https://sjdq7zsn.eu-central.insforge.app`; el artefacto de prueba usa `https://example.invalid`. |
| `font-src` | `'self'`: fuentes exportadas por Next. |
| `frame-src` | `'none'`: OAuth actual usa navegación, no iframe. |
| `object-src` | `'none'`: sin plugins/objetos embebidos. |
| `frame-ancestors` | `'none'`: prohíbe embeber la app; mantiene también X-Frame-Options DENY. |
| `base-uri` | `'self'`: restringe `<base>`. |
| `form-action` | `'self' https://sjdq7zsn.eu-central.insforge.app https://accounts.google.com`: formularios propios y destinos OAuth explícitos, sin wildcard. |

HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, sin `preload`.
Se conservan las cinco cabeceras anteriores y la regla de caché de `/_next/static/*`.

Los nonces de Next requieren renderizado dinámico y no son apropiados para este Worker de solo
assets. SRI de bundles no garantiza cobertura de los scripts inline; aquí se calculan sus hashes
directamente sin modificar los HTML. Si el sitio crece por encima del límite, el build falla;
no rebaja la política automáticamente. Referencias oficiales:
[Cloudflare _headers](https://developers.cloudflare.com/workers/static-assets/headers/),
[Next CSP](https://nextjs.org/docs/app/guides/content-security-policy).
Se contrastó también la guía instalada `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.

## Report-Only, correcciones y prueba efectiva

Primera pasada con Report-Only y hashes: `/` reportó dos violaciones `script-src` por `eval`;
las otras tres rutas reportaron esas dos más dos `connect-src` hacia el backend ficticio.
Comando de diagnóstico inicial: `node /tmp/csp-browser-probe.mjs`, exit 1. Se recogieron tanto
consola como eventos `securitypolicyviolation`, no solo mensajes de red.

Se identificaron llamadas de generación dinámica de Zod. `src/lib/public-env.ts` configura
`z.config({ jitless: true })`; la versión instalada ofrece esa opción y omite tanto su probe
`Function` como el compilador JIT (`zod/v4/core/util.js`, `schemas.js`). La validación del formulario
se comprobó en navegador con el intérprete; no se abrió `unsafe-eval`.

Se alineó `connect-src` con la URL pública del build. Antes de esa corrección había violaciones
CSP **además** del error DNS; tras ella, solo queda el error de red. No se silencian eventos CSP
filtrando `example.invalid` del resultado.

Segunda pasada Report-Only:

```text
node scripts/test-security-csp.mjs http://127.0.0.1:8791 --report-only
Checked 4 routes; 0 CSP violations.
exit 0
```

Tras pasar a CSP efectiva y reconstruir, se reinició Wrangler para cargar el `_headers` definitivo:

```text
pnpm exec wrangler dev --ip 127.0.0.1 --port 8791 --inspector-port 9291
[wrangler:info] Ready on http://127.0.0.1:8791
```

Una prueba intermedia contra Wrangler aún activo durante la reconstrucción leyó la plantilla
sin hashes y terminó con `TimeoutError` esperando el submit de signin, exit 1. Se corrigió
reiniciando el servidor **después** de completar el build; no se contó esa pasada como válida.

```text
node scripts/test-security-csp.mjs http://127.0.0.1:8791
Unhashed inline script blocked by script-src-elem.
Checked 4 routes; 0 CSP violations.
exit 0
```

| Ruta | HTTP | Violaciones CSP de la app | Errores JavaScript | Red esperada |
|---|---|---|---|---|
| `/` | 200 | 0 | 0 | Ningún error del backend |
| `/signin` | 200 | 0 | 0 | `https://example.invalid/api/auth/refresh`: `net::ERR_NAME_NOT_RESOLVED` |
| `/travel-inspiration` | 200 | 0 | 0 | Igual error DNS |
| `/dashboard` | 200 | 0 | 0 | Igual error DNS |

El script valida el formulario vacío para probar hidratación y Zod; además inyecta un script
inline sin hash en otra página y comprueba que el navegador lo bloquea. Esa violación deliberada
se separa de las cargas normales de la app. `/dashboard` se prueba sin sesión real y muestra el
guard/estado de error de autenticación; no se ha probado el interior autenticado con datos reales.

## Evidencia HTTP antes/después

Antes, producción, `curl -I https://app-viajes.prg-dev.workers.dev/`, exit 0.
Extracto real del 2026-10-20 a las 10:10:08 GMT:

```http
HTTP/2 200
content-type: text/html
cross-origin-opener-policy: same-origin-allow-popups
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
```

La respuesta no contenía CSP ni HSTS. No se desplegó este cambio, por lo que la evidencia del
después corresponde al export servido **localmente** por Wrangler, no a producción:

```text
curl -I http://127.0.0.1:8791/
exit 0
```

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=0, must-revalidate
ETag: "9ba86165f2901a007a656cc097a17771"
Strict-Transport-Security: max-age=31536000; includeSubDomains
CF-Cache-Status: HIT
content-security-policy: default-src 'self'; script-src 'self' 'sha256-4+2Xady/g1FnK8x30PjCeBTwOPC9P50042QqwznPB9s=' 'sha256-4k36ebRYBV16m5Ku1g6zSRzQiI9B1iGodEsk1nK0F2E=' 'sha256-7DaaHuLXSPV+lpL2zZi+CwG+HD2Z4fyaMwcpjUXd6m0=' 'sha256-IdXxyan2nikjbEwe8qPzme3mPW4GyzcKZvEzrh3/zcw=' 'sha256-OBTN3RiyCV4Bq7dFqZ5a2pAXjnCcCYeTJMO2I/LYKeo=' 'sha256-VfRfgE6Gx6sCC6i/8UqsHyRteItoeN7d9hZCVbdkpVc=' 'sha256-WmHw/GIevpM3HEzkeOCjsJdQ9orEO/rMK+YF5bopeUg=' 'sha256-Zuxhr+Yzk4cklJ8/Zzog3v+EJsMw2MlAKbk4srfvXfo=' 'sha256-anAY54wHcb4xPZFgYWjuppVUN9RBOZTDilSFEI59xbY=' 'sha256-axl7ylJKvr7bNXaGdw/7tSiWEafeumlPYUr0v0tHvZQ=' 'sha256-cHhIPtk/W94UQQWE9CF2NabqfLHttm4wGqqQCCVZam4=' 'sha256-e3yJS45ERAoybH2kFLtRmRDv1C2BzLqBLXpvR4XA3f4=' 'sha256-iJIRFrDIa0zMnfT9LemBel2hokWyMC2Bc1ajecENAVQ=' 'sha256-lmA+quqFPVvlT0afBf1ZwxdbGlmXBMP7FIJx5XjFBZc=' 'sha256-ncRioM0wHHTl6jCxAmqRVslmA3xCM0WEZrcbyEeuakE=' 'sha256-nn6z8m6m45q/mJy87mVpfrnYgXRQIvi9c8+4Pl1w6u8=' 'sha256-pkM3jbTstsv9hBFhV9qRjrjR5NxB6iykmjfKLWZgBdU=' 'sha256-sLBxXR5gAdFpBNQHa0BN7/8xHcZSBBdQBw1F5Ujnjmc=' 'sha256-thwQZIc7aJia336kEeAejeYZPijvpom4MipfkDS32+c=' 'sha256-uvgX58n575fKUTZWLiHnilr9iiTPDhhg+dbgBhgDatE=' 'sha256-wxd7sBQX51aSdJGomJTbzz0vi9nwFNbTof8tYzNY720=' 'sha256-zv7svY7bEkSsZ0fl23wuTWaVx/v2KiPXdGsqjJES0Tc='; style-src 'self' 'unsafe-inline'; img-src 'self' https:; connect-src 'self' https://example.invalid; font-src 'self'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://sjdq7zsn.eu-central.insforge.app https://accounts.google.com
cross-origin-opener-policy: same-origin-allow-popups
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
```

## Gates ejecutados

Comandos exactos, salida relevante y códigos de salida del estado final:

```text
$ pnpm run type-check
$ tsc --noEmit
exit 0

$ pnpm run lint
✖ 13 problems (0 errors, 13 warnings)
exit 0

$ pnpm exec jest --runInBand --coverage=false
Test Suites: 68 passed, 68 total
Tests:       485 passed, 485 total
Snapshots:   0 total
Time:        45.576 s, estimated 46 s
Ran all test suites.
exit 0

$ pnpm run build
$ next build && node scripts/build-security-headers.mjs
○  (Static)  prerendered as static content
Generated out/_headers with 22 inline script hashes.
exit 0

$ pnpm run validate:static-export
Validated 181 static files and 13 critical routes; no private key markers found.
exit 0

$ node scripts/check-security-headers.mjs
Validated 7 global security headers and 22 inline script hashes; CSP enforced.
exit 0

$ pnpm run check:headers
Validated 7 global security headers and 22 inline script hashes; CSP enforced.
exit 0

$ node --test scripts/security-headers.test.mjs
✔ exported headers reject missing headers, Report-Only, stale hashes and unsafe scripts
ℹ tests 1
ℹ pass 1
ℹ fail 0
exit 0
```

Baseline antes de modificar: lint tenía los mismos 13 warnings y 0 errores (exit 0);
Jest pasó 68 suites y 485 tests (exit 0, 44.653 s). No se modificaron las páginas interiores ni
`src/components/landing/` ni `src/components/ui/`. La única modificación de `src/` configura Zod.

Hubo restricciones iniciales del sandbox: `curl` falló con
`curl: (6) Could not resolve host: app-viajes.prg-dev.workers.dev` (exit 6);
Jest falló con `Error: Could not parse output from TypeScript's --showConfig.` (exit 1).
El primer build sin red quedó esperando y se interrumpió (exit 130). La instalación con lockfile,
el build con acceso de red y Jest fuera del sandbox resolvieron esas restricciones y se ejecutaron
completos. El test Node de subprocesos falló en sandbox con `'test failed'` (exit 1) y se repitió
fuera del sandbox con el resultado válido anterior. No se cambiaron dependencias ni el lockfile.

## Pendiente y límites

- Publicar queda fuera del encargo. Tras un despliegue autorizado, comprobar cabeceras HTTPS
  en producción y el comportamiento HSTS del navegador; HTTP local solo demuestra la cabecera.
- Probar Google OAuth completo y las vistas autenticadas, avatares y fotos firmadas con backend
  real. El inventario estático justifica sus permisos, pero aquí no hubo sesión ni credenciales reales.
- `img-src https:` y estilos inline son aperturas conscientes por funcionalidad existente.
  Restringirlas más exigiría cambiar el contrato de avatares o estilos, fuera de este alcance.
- Report-Only se probó localmente antes de aplicar la política. No hay colector remoto de informes
  CSP; la evidencia procede de consola y eventos del navegador. No se inventó un endpoint de reportes.


## Revisión independiente y limpieza

El subagente `reviewer` detectó un P2 en `package.json:7`: cargar solo `.env.local` con Node
no reproduce la expansión `${VARIABLE}` ni `.env.production[.local]` de Next. Se reprodujo
con las APIs instaladas (exit 0):

```json
{"nextBuildURL":"https://staging.example.invalid","nodeEnvFileURL":"https://${CSP_TEST_HOST}","nodeGeneratorOrigin":"https://${csp_test_host}"}
```

Un tercer contexto corrigió el generador para usar `loadEnvConfig` de `@next/env`, resuelto
desde la instalación de Next existente, en modo producción; no hay dependencia nueva. El test
Node ahora verifica interpolación desde `.env.production.local` y prioridad de variables heredadas.
Los seis gates y la prueba Playwright se repitieron tras esa corrección.

En esa repetición Jest falló una vez en el test existente
`FlightInspiration › reintenta al siguiente vencimiento tras un error y conserva las ideas aún vigentes`:
`Unable to find role="heading" and name "MAD → PAR"`, 1 failed/484 passed, exit 1.
Sus fixtures caducan a los 800 y 1.800 ms; el test corrió simultáneamente con el build.
Diagnóstico aislado, sin modificar ese código:

```text
pnpm exec jest --runInBand --coverage=false src/components/trips/__tests__/FlightInspiration.test.tsx
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Time:        5.491 s
exit 0
```

Una segunda pasada completa, sin build simultáneo, falló en otro caso del mismo archivo:
`oculta resultados caducados y muestra un error si falla la renovación automática`, con
`TestingLibraryElementError: Unable to find an accessible element with the role "alert"`
en el `getByRole` final (línea 218), 1 failed/484 passed, exit 1. Ese caso usa una caducidad de
500 ms. Por tanto, el primer fallo no se atribuye únicamente a la concurrencia con el build.
La última repetición completa se recoge en los gates de arriba. La sensibilidad
al tiempo de ese test existente queda documentada; no se alteró un test fuera del alcance.

Limpieza ejecutada: `rm .env.local`; comprobación `test ! -e .env.local` (exit 0).
`node scripts/check-security-headers.mjs` volvió a devolver
`Validated 7 global security headers and 22 inline script hashes; CSP enforced.` (exit 0)
después de borrar el entorno temporal. Se detuvo Wrangler con SIGINT (exit 130 esperado).


Segunda revisión independiente del diff completo: el revisor confirma el P2 resuelto y no
encuentra nuevos hallazgos. Verificó `node scripts/check-security-headers.mjs` (exit 0).
Su ejecución local del test de subprocesos quedó limitada por el sandbox; la ejecución completa
fuera de sandbox indicada arriba pasó (exit 0). La última suite Jest completa pasó 68/68 suites
y 485/485 tests, exit 0; los dos fallos intermitentes anteriores se conservan en este informe.
