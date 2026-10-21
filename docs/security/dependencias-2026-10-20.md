# Remediación de dependencias — 2026-10-20

Ejecución: 2026-10-21, worktree `deps-security/travelpal`, rama
`chore/deps-security`, base `4483868`. Node `v24.20.0`, pnpm `12.3.4`.
CI usa Node `22.22.3`; esta ejecución local no certifica ese otro runtime.

## Versiones y decisiones

| Paquete | Antes (lockfile / pnpm why) | Después (grafo resuelto) | Avisos |
| --- | --- | --- | --- |
| sharp | 0.35.4 (Next), 0.35.2 (Wrangler/Miniflare) | 0.35.5 | GHSA-wq5f-xc86-pv6w / CVE-2026-96889 |
| source-map-js | 1.2.1 y 1.2.2 | 1.2.2 | GHSA-68fv-2mgg-jv7q |
| browserslist | 4.26.3 | 4.28.7 | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g |
| dompurify | 3.4.15 | 3.4.16 | GHSA-p98j-92pf-mc4p, GHSA-6688-9rhm-gjv2 |
| @babel/core | 7.28.4 | 7.29.6 | GHSA-4x5r-pxfx-6jf8 |

`pnpm audit --prod` inicial: exit **1**, salida:

```text
7 vulnerabilities found
Severity: 3 low | 4 high
```

Se intentó primero actualizar con pnpm, sin añadir dependencias directas:

```sh
pnpm update sharp@0.35.5 source-map-js@1.2.2 browserslist@4.28.7 dompurify@3.4.16 @babel/core@7.29.6 --no-save
```

Exit **1**, error literal:

```text
Error: ERR_PNPM_UPDATE_VERSION_ON_INDIRECT_DEP
```

pnpm rechaza registrar versiones exactas de dependencias indirectas. Después,
`pnpm update sharp source-map-js browserslist dompurify @babel/core --lockfile-only`
(exit **0**) seleccionó sharp 0.35.5, source-map-js 1.2.2, browserslist 4.29.4,
DOMPurify 3.4.17 y Babel 7.29.7. Se descartó ese resultado para limitar la
remediación a las versiones mínimas corregidas solicitadas.

Se usan overrides condicionados al rango vulnerable para cada uno de los cinco
paquetes: impiden conservar copias vulnerables sin actualizar Next, jsPDF ni los
otros padres. Babel y Browserslist requieren avanzar también su versión menor
respecto al lock inicial; las versiones mínimas indicadas no son parches de
7.28.x y 4.26.x. Los helpers transitivos requeridos por Babel se resuelven por
pnpm; no se añade ninguna dependencia directa ni se cambia un API de la app.

La ubicación efectiva es `pnpm-workspace.yaml`: al probar `pnpm.overrides` en
`package.json`, pnpm 12.3.4 emitió literalmente:

```text
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides". See https://pnpm.io/settings for the new home of each setting.
```

Se retiró ese campo ignorado; `package.json` queda sin cambios. Cada override
solo fuerza versiones inferiores al mínimo corregido. `pnpm install --lockfile-only`
regeneró el lockfile (exit **0**). Se restauraron las dos resoluciones
originales de `@testing-library/user-event` (14.6.1 directa y 14.6.7 transitiva
de Storybook), actualizadas incidentalmente durante la resolución, y se
repitieron todos los gates sobre el lockfile final. pnpm también deduplica referencias transitivas ya existentes en el lock:
`@testing-library/dom` pasa a usar `@babel/code-frame` 7.29.7 y
`@typescript-eslint/typescript-estree` pasa de tinyglobby 0.2.15 a 0.2.17.
También se deduplica `@jridgewell/sourcemap-codec` de 1.5.5 a 1.6.0.
Son dependencias de las herramientas de compilación/pruebas/lint, cubiertas por los gates;
no se incorpora un paquete directo nuevo.

La resolución final elimina las entradas vulnerables, incluida Babel 7.28.4;
`pnpm why` resuelve Babel 7.29.6.

## Compatibilidad y límites

No se modifica `src/`, la configuración de imágenes ni el render de notas.
El supuesto del encargo sobre DOMPurify y notas no coincide con este código:
`src/components/notes/NoteEditor.tsx` tiene un preview Markdown que construye
nodos React y escapa HTML; su test existente verifica que un `<img onerror>`
se muestra como texto y no crea una imagen. `NoteCard.tsx` también renderiza
texto. La suite completa mantiene esos tests aprobados.
DOMPurify llega como dependencia opcional de jsPDF; el dashboard crea el PDF
mediante `toPng` y `pdf.addImage`, sin cambiar esa implementación.

Next declara sharp como dependencia opcional. `next.config.js` mantiene
`output: "export"` e `images.unoptimized: true`: no se introduce optimización
de imágenes en runtime. Wrangler sigue sirviendo únicamente `out/`. Los hashes
de las nueve imágenes exportadas son idénticos antes/después.
No se ha probado un backend real ni se han usado credenciales reales: build y
Storybook usan exactamente los valores ficticios públicos de `jest.setup.js`.
No se realiza push, PR ni deploy.

## Gates finales

Salidas relevantes reales; todos los comandos de esta sección terminaron con
exit **0**. Build y Storybook necesitan las siguientes variables públicas
ficticias (mismos valores en baseline y candidato):

```sh
export NEXT_PUBLIC_INSFORGE_URL=https://test-appkey.eu-central.insforge.app
export NEXT_PUBLIC_INSFORGE_ANON_KEY=test-insforge-anon-key
```

```text
$ pnpm install --frozen-lockfile
Lockfile is up to date, resolution step is skipped
Packages: +2 -1
Progress: resolved 2, reused 2, downloaded 0, added 2, done

$ pnpm audit --prod
No known vulnerabilities found

$ pnpm run type-check
$ tsc --noEmit

$ pnpm run lint
$ eslint
✖ 13 problems (0 errors, 13 warnings)

$ pnpm exec jest --runInBand --coverage=false
Test Suites: 71 passed, 71 total
Tests:       526 passed, 526 total
Snapshots:   0 total
Time:        54.216 s
Ran all test suites.

$ pnpm run build
$ next build && node scripts/build-security-headers.mjs
▲ Next.js 16.3.8 (Turbopack)
✓ Compiled successfully in 536ms
○  (Static)  prerendered as static content
Generated out/_headers with 22 inline script hashes.

$ pnpm run validate:static-export
$ node scripts/validate-static-export.mjs
Validated 182 static files and 13 critical routes; no private key markers found.

$ pnpm run test:storybook
$ vitest run --project=storybook
Test Files  11 passed (11)
     Tests  50 passed (50)
  Duration  10.38s
```

Baseline anterior al cambio de paquetes: Jest 71 suites / 526 tests, exit **0**;
lint 0 errores / 13 advertencias, exit **0**. No aparecen advertencias nuevas.
El audit final cierra los siete avisos originales; no hay excepción sin arreglo.

### Determinismo

Después de los gates se repitió la instalación con el lockfile congelado:

```sh
sha256sum pnpm-lock.yaml > /tmp/travelpal-deps-evidence/lock-before.sha256
pnpm install --frozen-lockfile
sha256sum -c /tmp/travelpal-deps-evidence/lock-before.sha256
```

Instalación: exit **0**, `Lockfile is up to date, resolution step is skipped`.
Comprobación: exit **0**, `pnpm-lock.yaml: OK`.
SHA-256 anterior y posterior:
`5fbdbadf41d86cd8709267884eee8d2bcbf13c2d924ecd1fe110710c8f3bad70`.

## Tamaño del export y bundle

Dos builds de la misma base/candidato, con las mismas variables ficticias,
Node y pnpm. Se suma el tamaño de cada fichero regular de `out/` (sin contar
bloques de disco ni directorios); gzip por fichero con `mtime=0`.

| Medida | Antes | Después | Delta |
| --- | ---: | ---: | ---: |
| Ficheros del export | 182 | 182 | 0 |
| Export completo, bytes | 6.703.476 | 6.703.476 | 0 |
| JS (54 ficheros), bytes | 3.925.367 | 3.925.367 | 0 |
| JS gzip, bytes | 1.153.233 | 1.153.233 | 0 |
| Mayor chunk JS, bytes | 592.739 | 592.739 | 0 |
| CSS (5 ficheros), bytes | 77.518 | 77.518 | 0 |
| CSS gzip, bytes | 16.164 | 16.164 | 0 |
| Imágenes (9 ficheros), bytes | 1.362.290 | 1.362.290 | 0 |
| Mayor imagen, bytes | 538.850 | 538.850 | 0 |

No crece el bundle ni el export; no hay entrypoint Worker añadido. Este cálculo
mide assets y no confunde su tamaño con el límite de código Worker.
La medición, repetible tras cada build, usa:

```python
from pathlib import Path
import gzip, hashlib
files = [p for p in Path("out").rglob("*") if p.is_file()]
print(len(files), sum(p.stat().st_size for p in files))
for extension in (".js", ".css"):
    group = [p for p in files if p.suffix == extension]
    print(extension, len(group), sum(p.stat().st_size for p in group),
          sum(len(gzip.compress(p.read_bytes(), mtime=0)) for p in group),
          max(p.stat().st_size for p in group))
for p in sorted(files):
    if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".svg", ".webp", ".avif", ".ico"):
        print(p.relative_to("out"), hashlib.sha256(p.read_bytes()).hexdigest())
```

## Intentos fallidos y corrección del entorno

- Primera instalación dentro del sandbox: exit **1**, `ERR_PNPM_TARBALL_FETCH_TARBALL`,
  `failed to lookup address information: Temporary failure in name resolution`.
  Repetida con acceso de red: exit **0**.
- Jest baseline dentro del sandbox: exit **1**,
  `Error: Could not parse output from TypeScript's --showConfig.`
  Repetido fuera de ese aislamiento: exit **0**, suite completa.
- Primer build dentro del sandbox quedó bloqueado al compilar; se terminó su
  proceso propio con SIGTERM (exit **143**). Un intento simultáneo falló con
  exit **1**, `⨯ Another next build process is already running.`
  Después se ejecutaron los builds secuencialmente fuera del sandbox.
- Build sin variables públicas: exit **1**, `Error: ❌ Configuración de entorno inválida:`,
  `NEXT_PUBLIC_INSFORGE_URL: es obligatoria (falta en .env.local)` y
  `NEXT_PUBLIC_INSFORGE_ANON_KEY: es obligatoria (falta en .env.local)`.
  Repetición completa con los valores de test: exit **0**.
- Primer Storybook sin esas variables: exit **1**, mismo error de configuración;
  `Test Files  2 failed | 9 passed (11)` / `Tests  38 passed (38)`.
  Repetición completa con valores de test: exit **0**, 11 ficheros / 50 tests.

- En la repetición sobre el lock final, Jest falló una vez con exit **1**:
  `FlightInspiration › reintenta al siguiente vencimiento tras un error y conserva las ideas aún vigentes`,
  `Unable to find role="heading" and name "MAD → PAR"` (línea 252 del test),
  `Test Suites: 1 failed, 70 passed, 71 total`,
  `Tests: 1 failed, 525 passed, 526 total`. El test usa reloj real con
  vencimientos de 800/1.800 ms y coincidió con la ejecución de Storybook.
  La relación con la carga es una hipótesis, no una causa demostrada.
  Se conservó el fallo y se repitió la suite completa en solitario:
  exit **0**, `Test Suites: 71 passed, 71 total`,
  `Tests: 526 passed, 526 total`, `Time: 54.216 s`. No se modificó
  código ni tests; el fallo intermitente queda registrado como límite de la suite.


## Comprobaciones adicionales del repositorio

Todas con exit **0**:

```text
$ pnpm run test:trip-owner-rls
$ node scripts/test-trip-owner-rls.mjs
RLS trip_id behavior passed

$ pnpm run test:timezone
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total

$ node scripts/check-data-paths.mjs
OK: sin puntos nuevos en el camino bff.

$ git diff --check
(sin salida)
```
