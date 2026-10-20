# Landing: footer, movimiento y carga de imágenes

Rama `design/landing-detalles`, base `9f1abff`. Implementación limitada a composición de landing, componentes locales, tests y esta evidencia. Auditoría previa: [audit.md](audit.md); informe independiente original: [review-initial.md](review-initial.md). Revisión del cambio y corrección: [review-change.md](review-change.md), [review-final.md](review-final.md).

## Cambios y decisiones

- Footer global fuera de main, tres bloques: marca y explicación, producto, proyecto. Mismos márgenes que cabecera, enlaces de 44 px y foco visible. Repositorio y licencia MIT contrastados con origin y LICENSE. Nota de TFG y procedencia IA de ilustraciones.
- Año mediante useSyncExternalStore en cliente, comprobación a medianoche y al recuperar foco/visibilidad. El HTML exportado no congela ningún año. Sin JavaScript se conserva copyright y licencia sin año; el hueco de cuatro cifras se reserva para evitar saltos al hidratar.
- IntersectionObserver observa las secciones que empiezan fuera de viewport; animación única de 360 ms, opacidad desde .65 y desplazamiento de 10 px mediante transform. Contenido visible por defecto y sin JS; el hero y lo ya visible al montar permanecen inmediatos.
- CTA con sombra breve, enlaces con subrayado y tarjetas del ejemplo con cambio de color. Transiciones enumeradas, sin librerías nuevas. Se conserva la marca con mask-image y no cambia el copy de las secciones existentes.
- LandingImage reserva proporción y muestra papel entonado mientras carga; onLoad permite fundido de 220 ms. Error termina el estado de carga y deja el texto alternativo nativo. Ref reconoce imágenes ya completas; sin JS las imágenes permanecen visibles. Solo el hero usa preload (equivalente actual de priority, deprecado en Next 16); la segunda imagen sigue lazy.
- En móvil Features conserva proporción 3:2 (260 px a 390). En escritorio la altura estable viene de la columna de texto, como en la composición original; se anula el aspect-ratio preferido para estirar el frame y se fija min-width:0 para que no desborde el grid. La prueba reproduce el recorte a 1024 antes y pasa en cinco anchos después.
- prefers-reduced-motion anula animaciones y transiciones, también si cambia con la página abierta. No hay skeleton animado ni espera artificial.

## Capturas inspeccionadas

Finales sobre export servido por Wrangler, viewport 1440×900 / 390×900, contenido en estado final y reduced-motion. Se abrieron las cuatro páginas completas y los skeletons para verificación visual: sin cortes ni solapamientos; footer apilado móvil y tres columnas escritorio.

| Vista | Landing final | Footer final | Antes |
|---|---|---|---|
| 1440 claro | [captura](after-1440-light.png) | [footer](after-footer-1440-light.png) | [antes](before-1440-light.png) |
| 1440 oscuro | [captura](after-1440-dark.png) | [footer](after-footer-1440-dark.png) | [antes](before-1440-dark.png) |
| 390 claro | [captura](after-390-light.png) | [footer](after-footer-390-light.png) | [antes](before-390-light.png) |
| 390 oscuro | [captura](after-390-dark.png) | [footer](after-footer-390-dark.png) | [antes](before-390-dark.png) |

[Placeholder 1440](skeleton-1440-light.png), [placeholder 390](skeleton-390-light.png). Las vistas signin-* corresponden a la auditoría inicial, sin modificar acceso. Sesión anónima simulada únicamente para esa captura; no se verificó autenticación real.

## Navegador y regresión

Comandos exactos (desde la raíz):

```sh
pnpm run preview --port 4173 --ip 127.0.0.1
node docs/qa/audits/2026-10-20-landing-motion/check.mjs
node docs/qa/audits/2026-10-20-landing-motion/capture.mjs after
```

Preview: `[wrangler:info] Ready on http://127.0.0.1:4173`. Check: exit 0. Salida íntegra en [browser-results.jsonl](browser-results.jsonl). Captura: exit 0:

```text
after 1440 light: captured
after 1440 dark: captured
after 390 light: captured
after 390 dark: captured
```

Resultados: cuatro vistas con axeViolations:0, overflow:false, minimumLinkHeight:44 y reducedMotion:none; foco alcanzado por Tab. Diez comprobaciones del grid (JS on/off, 1024/1100/1200/1280/1440) con texto e imagen dentro de su fila. A 1440 y 390 se retuvieron ambos assets antes de liberar la carga: reservedRectanglesUnchanged:true, cls:0, preloadCount:1, segunda imagen loading:lazy. El cambio de preferencia a reduce deja animationName:none. Sin JS siguen visibles h1 e imagen y no aparece año congelado.

La regresión de grid quedó roja antes de corregir: exit 1, `AssertionError [ERR_ASSERTION]: Features no debe recortar la columna de texto`, columnas `242.812px 933.75px`, texto `984.5`, sección `622.5`. Tras corregir: columnas `536.375px 487.625px`, texto/imagen/sección `622.5` a 1024.

## Gates

Entorno temporal solicitado: `.env.local` con NEXT_PUBLIC_INSFORGE_URL=https://example.invalid y NEXT_PUBLIC_INSFORGE_ANON_KEY=placeholder. Build sin INSFORGE_API_KEY. Node local v24.20.0, pnpm12.3.4. Los comandos con subprocess/servidor/navegador se ejecutaron fuera del sandbox por sus restricciones.

### `pnpm run type-check`

Exit code: **0**. Salida real relevante:

```text
$ tsc --noEmit
```

### `pnpm run lint`

Exit code: **0**. Salida real relevante:

```text
$ eslint
✖ 13 problems (0 errors, 13 warnings)
```

### `pnpm exec jest --runInBand --coverage=false`

Exit code: **0**. Salida real relevante:

```text
Test Suites: 68 passed, 68 total
Tests:       490 passed, 490 total
Snapshots:   0 total
Time:        44.334 s, estimated 51 s
Ran all test suites.
```

### `pnpm run build`

Exit code: **0**. Salida real relevante:

```text
$ next build
▲ Next.js 16.3.8 (Turbopack)
✓ Compiled successfully in 1542ms
  Finished TypeScript in 3.6s ...
  Generating static pages using 11 workers (0/22) ...
  Generating static pages using 11 workers (5/22)
  Generating static pages using 11 workers (10/22)
  Generating static pages using 11 workers (16/22)
✓ Generating static pages using 11 workers (22/22) in 790ms
○  (Static)  prerendered as static content
```

### `pnpm run validate:static-export`

Exit code: **0**. Salida real relevante:

```text
$ node scripts/validate-static-export.mjs
Validated 181 static files and 13 critical routes; no private key markers found.
```

### `pnpm run test:storybook`

Exit code: **0**. Salida real relevante:

```text
$ vitest run --project=storybook
 Test Files  9 passed (9)
      Tests  39 passed (39)
   Duration  7.01s (transform 0ms, setup 18.70s, import 4.90s, tests 15.47s, environment 0ms)
```

## Incidencias de ejecución resueltas y límites

- Los primeros intentos de lint/Jest intentaron auto-instalar dependencias dentro del sandbox y terminaron con exit 1: `ERR_PNPM_TARBALL_FETCH_TARBALL`, `Temporary failure in name resolution`. Se repitieron tras instalar fuera del sandbox.
- Dependencias no enlazadas al iniciar. `pnpm install --frozen-lockfile` fuera del sandbox: exit 0, `Done in 1.1s using pnpm v12.3.4`. No hay cambios de package.json/lockfile ni dependencias nuevas.
- Sandbox: Next dev dio exit 1, `listen EPERM: operation not permitted 127.0.0.1:3000`; Jest dio exit 1, `Could not parse output from TypeScript's --showConfig`. Repeticiones escaladas ejecutaron los procesos reales correctamente, sin modificar configuración.
- La preview inicial de desarrollo, con solo las variables públicas, dio exit 1: `INSFORGE_API_KEY: es obligatoria (sólo servidor, nunca exponerla al cliente)` desde instrumentation existente. Para esa preview se pasó únicamente `INSFORGE_API_KEY=placeholder` en el proceso; ninguna clave real. El build final y la preview Wrangler del export no necesitaron esa variable.
- Red TDD: footer y placeholder dieron exit 1, 2 tests fallidos/3 pasados antes de implementación; después la suite completa pasa. En pruebas nuevas se corrigieron un cast incompleto (TS2352, type-check exit 2) y un mock matchMedia que había quedado sin implementación entre tests (1 test fallido, exit 1). El wrapper necesitó alt explícito para evitar un aviso nuevo. Lint final queda en los mismos 13 avisos de la base.
- Storybook tuvo dos ejecuciones con exit 1 por `Failed to fetch dynamically imported module`, en BookingCard/setup-file y después ItineraryPlanner. Se ejecutó la suite completa con `pnpm run test:storybook --no-file-parallelism`: 9 archivos/39 tests, exit 0. Después se repitió el comando exacto solicitado sobre el árbol final con exit 0. No se tocaron stories, configuración ni dependencias. La causa exacta de los fallos transitorios no quedó demostrada; no se atribuye al código de landing.
- Revisor detectó un P2 de grid en el primer pase. Se corrigió en tercer contexto; prueba de navegador roja antes y verde después; segundo pase independiente sin hallazgos. No se oculta el fallo inicial.
- No hay página real de privacidad, contacto ni términos: siguen siendo un hueco de contenido fuera de este cambio. La licencia MIT no sustituye una política de privacidad. No se añadieron enlaces ficticios.
- Esta comprobación cubre Chromium y las vistas/estados citados; no equivale a prueba de autenticación real, otros motores ni todos los recorridos de accesibilidad.

## Limpieza y alcance

Se elimina el fichero temporal `.env.local` antes del commit. Ninguna clave ni fichero de entorno forma parte del cambio. No se modifica UI compartida, public/_headers, marca, dependencias ni páginas interiores. No hay push, PR ni despliegue.

Comprobación de limpieza ejecutada:

```sh
test ! -e .env.local && git diff --check && git diff --exit-code HEAD -- src/components/ui public/_headers src/components/landing/Brand.tsx public/brand/travelpal-mark.svg package.json pnpm-lock.yaml
```

Exit 0, sin salida. El fichero temporal ya no existe y no hay cambios en esos ficheros protegidos. Revisión completa de los call sites de LandingImage, LandingMotion y CurrentYear, y del diff de implementación.
