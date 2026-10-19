# Marca TP en acceso — 19 de octubre de 2026

Alcance: `AuthBrand.tsx` y su uso desde `AuthShell.tsx`. Acceso, registro,
recuperación y restablecimiento reutilizan la marca suelta autoritativa de
`public/brand/travelpal-mark.svg` mediante máscara CSS, pintada con currentColor.
Sin globo ni fondo decorativo. Se conserva el texto visible TravelPal, el enlace
al inicio, foco visible y un objetivo de 44 px. Monocromo tanto en claro como en
oscuro; toma el color ink del texto, sin colores de estado. La landing no cambia.

El worktree anterior había desaparecido y no existía ya su rama local. Tras
`git fetch origin main`, main seguía en `02ace1b4c3c594f2b3ed66d55393dfa86159f543`
sin los assets anunciados. La marca aprobada sí estaba en `design/logo-proposals`,
commit `fab29d42dda84ffc1a45e6c8a1b30aa7d0d5dd95`. Se recreó el worktree de auth y
la rama `codex/auth-brand-a11y` desde ese commit. Esta entrega solo aplica la marca
al shell existente en esa base; no recupera el rediseño previo de Mesa de viaje.
No modifica main, icon.svg, public/brand ni docs/design/logo. No hay commit o push.

## Verificación real

Desde la raíz de este worktree:

```bash
pnpm exec jest --runInBand --coverage=false src/components/auth/__tests__
```

Exit 0: `Test Suites: 8 passed, 8 total`; `Tests: 41 passed, 41 total`;
`Time: 5.424 s`. Los avisos de consola de pruebas preexistentes siguen en la salida.

```bash
pnpm run type-check
pnpm exec eslint src/components/auth/AuthBrand.tsx src/components/auth/AuthShell.tsx
git diff --check
```

Exit 0 en los tres. TypeScript: `$ tsc --noEmit`. Lint y diff check: sin salida.

Runtime QA, con configuración ficticia (sin leer secretos):

```bash
NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder INSFORGE_API_KEY=qa-placeholder E2E_DISABLE_DEV_INDICATORS=1 pnpm run dev --port 3010
node docs/qa/audits/2026-10-19-auth-tp/verify.mjs
```

El proceso dev queda activo; `verify.mjs` terminó con exit 0:
`16 auth route/theme/viewport checks passed; logo HTTP 200; currentColor, accessible home link, focus and scoped axe passed`.

La captura final usa una fixture explícita de visitante sin sesión: Playwright
intercepta solo example.invalid y responde 401 (OPTIONS 204). No oculta elementos
de UI ni cambia código de auth. Evita avisos de red causados por el dominio de
prueba; no se conecta a InsForge real.

El primer intento de arrancar dev sin el valor ficticio INSFORGE_API_KEY falló
por la validación del entorno de este checkout; se añadió solo al entorno del
proceso y se repitió toda la comprobación de navegador. Sin cambios de backend.
El navegador integrado no estaba disponible (`Browser is not available: iab`);
las capturas proceden de Chromium con Playwright. Se inspeccionaron los recortes
reales de la marca en claro y oscuro y el registro completo de escritorio.

Comprobaciones: cuatro rutas, anchos 390/1440, temas claro/oscuro. El SVG devuelve
HTTP 200; la máscara usa el asset canónico y coincide con el color del enlace.
El enlace TravelPal tiene destino `/`, admite foco y pasa axe en el alcance de
la marca. No se enviaron credenciales ni formularios ni se comprobó autenticación
real. Las capturas no acreditan una revisión completa de los formularios antiguos.

```bash
git diff --exit-code fab29d4 -- src/app/icon.svg public/brand docs/design/logo
```

Exit 0, sin salida: los ficheros excluidos de la asignación permanecen idénticos
al commit base. El nuevo AuthBrand no duplica geometría del logo.

## Revisión independiente

Revisor read-only: sin hallazgos en el diff y en el ajuste posterior `w-fit`.
Repitió `pnpm exec jest --runInBand --coverage=false src/components/auth/__tests__`: 
exit 0, 8 suites y 41 tests aprobados. La inspección de capturas y los 16 casos
de navegador corresponden al hilo implementador, no al revisor.

## Actualización de base tras el merge de #103

Se verificó con `git fetch origin main` que origin/main ya apunta a
`9ed00a52f2b35acc921f7f052161fbbac9092d9d` e incluye fab29d4.
`git rebase --autostash origin/main` terminó con exit 0:
`Applied autostash.` y `Successfully rebased and updated refs/heads/codex/auth-brand-a11y.`
Solo había WIP propio; el cambio de import y los ficheros nuevos se conservaron.
HEAD de la rama queda en 9ed00a5; AuthBrand sigue sin commit.

Se repitieron tras rebasar:

- `pnpm run type-check`: exit 0, `$ tsc --noEmit`.
- `pnpm exec eslint src/components/auth/AuthBrand.tsx src/components/auth/AuthShell.tsx`: exit 0, sin salida.
- `pnpm exec jest --runInBand --coverage=false src/components/auth/__tests__`: exit 0,
  `Test Suites: 8 passed, 8 total`; `Tests: 41 passed, 41 total`; `Time: 2.987 s`.
- `git diff --check`: exit 0, sin salida.
- `git diff --exit-code origin/main -- src/app/icon.svg public/brand`: exit 0, sin salida.

El estado de main sin assets descrito arriba corresponde a la inspección inicial;
queda superado por esta actualización. No se ha creado commit, PR ni push.

## Nota de integración (19 de octubre, tarde)

Al unir esta entrega con la de la landing se comprobó que `AuthBrand.tsx` duplicaba
`src/components/landing/Brand.tsx` casi línea a línea. Se conservó **un único componente compartido**
(`src/components/landing/Brand.tsx`, que ya usaba `AuthShell` antes de este trabajo) y se le añadió
el `min-h-11 w-fit` que aportaba la versión de acceso, para no perder el objetivo de 44 px. El
`AuthBrand.tsx` de esta carpeta no llegó al repositorio. Los assets son los mismos y las
comprobaciones de esta auditoría siguen valiendo: el componente que pinta la marca es idéntico en
comportamiento y solo cambia de dónde se importa.
