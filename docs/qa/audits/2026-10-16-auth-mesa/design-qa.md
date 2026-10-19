# Auth · Mesa de viaje

Fecha: 16 de octubre de 2026. Worktree `codex/auth-brand-a11y`; HEAD inicial
`c0ef4bd65c5a62eedd41a90626a8a2b7963a714f`, status y diff vacíos antes del trabajo.
Alcance: signup/signin y paso OTP, presentación, assets, accesibilidad y pruebas.
No se modifican servicios, sesión, backend, RLS, callbacks ni rutas. Recovery/reset
conservan el shell anterior. Este informe es propio de auth; el `design-qa.md` de
raíz conserva la historia de la landing.

## Objetivo y evidencia visual

Pablo eligió explícitamente opción 2, Mesa de viaje. Referencia exacta copiada
antes de implementar a `docs/design/assets/auth-mesa-2026-10-16/reference.png`.
Abierta con view_image, junto con referencia de landing y asset generado.

Comparación al mismo viewport/estado: referencia 1487×1058, signup claro vacío
1487×1058 CSS px, deviceScaleFactor 1. Se abrieron juntos en
`docs/design/assets/auth-mesa-2026-10-16/comparison.webp`: referencia izquierda,
implementación derecha, ambas normalizadas a 744×529 solo para el montaje.
Las capturas originales mantienen la resolución completa.

Capturas en `docs/design/assets/auth-mesa-2026-10-16/`:

- `signup-light-1487.webp`, `signup-dark-1487.webp`, `signin-light-1487.webp`, `signin-dark-1487.webp`.
- `signup-light-390.webp`, `signup-dark-390.webp`, `signin-light-390.webp`, `signin-dark-390.webp`: viewport 390×844.
- Sufijos `-390-full.webp` y `-390-validation.webp`: páginas móviles completas y errores cliente.

Inspección directa adicional en navegador integrado: signup abre en 3010;
mostrar/ocultar contraseña cambia nombre y estado; no se enviaron formularios
válidos. Se conservó la pestaña. El primer arranque falló por faltar entorno local;
se usaron valores ficticios para todo el servidor de QA y las pruebas. No se leyó
ni imprimió ningún fichero de credenciales. No hubo rechazo de política en esta
sesión: los primeros intentos del navegador dieron ERR_CONNECTION_REFUSED hasta
arrancar el servidor con entorno ficticio.

## Comparación e iteraciones

1. Primer render: jerarquía editorial, formulario derecho sin tarjeta y bodegón
   independiente reproducen la opción elegida. Se ajustaron separación entre
   campos y tracking del titular al compararlos con la referencia.
2. Axe detectó `link-in-text-block` en el enlace de cuenta de la cabecera de
   escritorio. Se añadió subrayado visible; repetida la suite completa.
3. Se reforzaron bordes con mezcla de tokens muted/paper; se mantuvieron fuente,
   marca y azul de acción del sistema actual. Nuevo render/capturas posteriores.
4. Móvil: promoción y arte ocultos, formulario y Google visibles en el viewport
   inicial de 390×844. El pie puede requerir un desplazamiento breve; no existe
   segunda pantalla promocional. La validación puede ampliar el formulario.
5. Oscuro: tokens semánticos en fondo, texto, acciones, errores y fortaleza.
   Bodegón transparente inspeccionado sobre claro y oscuro; sin bloques o franjas
   de fondo. Los artefactos del visor de alfa no aparecen al componer sobre papel.

Sin P0/P1/P2 visuales abiertos tras repetir capturas y comparar. Diferencias P3
conservadas deliberadamente: marca del componente existente, tintas/azul de tokens,
texto de ayuda completo de contraseña acorde al esquema real (no solo «8 caracteres»),
y colocación interna del bodegón generado. La ilustración no es idéntica píxel a
píxel; conserva cuaderno, postal, taza, tickets, pluma y olivo. No se simula fidelidad
numérica ni un test de regresión de imagen.

## Verificación ejecutada

Baseline antes de código:

- `pnpm exec eslint src/components/auth src/app/signin src/app/signup`: exit 0, sin salida.
- `pnpm exec jest --runInBand --coverage=false src/components/auth/__tests__`: exit 0,
  `Test Suites: 7 passed, 7 total`; `Tests: 38 passed, 38 total`.
- `pnpm run type-check`: falló inicialmente por `.next/dev/types/validator.ts`
  truncado (`TS1109`, líneas 62–66). `pnpm exec next typegen` regeneró types de build
  pero no reparó el dev cache. Se movió solo ese fichero generado fuera del árbol
  a `/tmp/travelpal-auth-stale-validator.ts`; Next dev lo regeneró. Sin cambios a
  tsconfig ni al código para ocultar errores.
- Test de contrato nuevo ejecutado antes de implementar shell: exit 1,
  `2 failed, 6 passed, 8 total` porque faltaba la composición Mesa de viaje.

Comprobaciones finales:

```bash
pnpm run type-check
pnpm exec eslint src/components/auth src/app/signin src/app/signup e2e/smoke/auth-mesa-layout.spec.ts
git diff --check
```

Exit 0 en los tres. TypeScript imprime `$ tsc --noEmit`; ESLint y diff check sin salida.

```bash
pnpm exec jest --runInBand --coverage=false
```

Exit 0: `Test Suites: 64 passed, 64 total`; `Tests: 464 passed, 464 total`;
`Time: 44.397 s`. Existen avisos previos act/consola de tests; no se ocultan ni
se consideran una consola silenciosa. Incluye OTP, reenvío/cooldown, OAuth con
mock, errores callback, alta con/sin verificación y login/recuperación.

```bash
NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder INSFORGE_API_KEY=qa-placeholder E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test e2e/smoke/auth-mesa-layout.spec.ts e2e/smoke/landing-auth-layout.spec.ts e2e/smoke/signup-accessibility.spec.ts e2e/smoke/signin-controls.spec.ts --project=smoke --workers=1
```

Exit 0: `37 passed (59.1s)`. Incluye claro/oscuro, 390/1440/1487 px, imágenes
cargadas, ausencia de desbordamiento, axe sin violaciones en estados cubiertos,
errores cliente asociados, fortaleza débil/fuerte y confirmación que no coincide,
objetivos táctiles, teclado, reduced motion, recovery/reset y landing existente.
Primera pasada falló con 10 casos por los enlaces; tras corregir se repitió toda
la suite, primero 35/35 y finalmente 37/37 con los dos casos adicionales.

Escaneo estático de líneas añadidas (se compararon src y e2e, incluidos ficheros
nuevos): `Added-line static scan: 0 matches`, exit 0. Sin credenciales, eval/exec,
innerHTML ni llamadas shell peligrosas nuevas. Diff completo y call sites revisados.

Después de añadir `loading="eager"` al asset para eliminar el aviso LCP de Next,
se repitió el contrato del shell:

```bash
pnpm exec jest --runInBand --coverage=false src/components/auth/__tests__/auth-pages.test.tsx
```

Exit 0: `Test Suites: 1 passed, 1 total`; `Tests: 8 passed, 8 total`.
TypeScript, ESLint y diff check también se repitieron con exit 0. No cambia el
encuadre de las capturas. No se ejecutó build de producción ni despliegue; el
runtime verificado es Next dev local.

## Límites del ensayo

Datos sintéticos. No se crearon usuarios, enviaron correos, completaron OAuth real,
restablecieron contraseñas ni mutaron datos de producción. La continuidad de esas
ramas se prueba con Jest y sus mocks existentes; las pruebas de navegador cubren
presentación e interacción local. No se acredita lector de pantalla, Safari/iOS,
Firefox o todo el cumplimiento WCAG con axe. El entorno de QA en 3010 usa
example.invalid y no sirve para iniciar una sesión real.

## Revisión independiente

Revisor independiente read-only: «Sin hallazgos». Revisó diff completo, CSS,
call sites, recuperación/reset y ramas de sesión, OAuth y verificación. Ejecutó
`pnpm exec jest src/components/auth/__tests__ --runInBand --coverage=false`: exit 0,
`7 suites, 42 tests aprobados`. El riesgo residual señalado es el ensayo con
datos sintéticos, explicitado arriba.

final result: passed
