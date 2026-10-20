# Skeletons del interior · 20 de octubre de 2026

Rama `feat/interior-skeletons`, base `9f1abff`. Primitivas `Skeleton`, `SkeletonText` y `SkeletonCard`, composiciones de las doce pantallas y umbral compartido de 120 ms en `useDelayedLoading`. El shell conserva la espera desde la consulta de sesión hasta las consultas de página. Nuevo gasto incorpora únicamente un flag de lectura de viajes; las consultas y las mutaciones existentes se conservan.

Las formas decorativas tienen `aria-hidden="true"`; un estado separado anuncia la carga. Color derivado de `muted` y `paper`, bordes `line` y espaciados Atlas. El héroe del dashboard comparte `nextTrip.module.css` con el contenido final. Hay reserva de espacio también durante los primeros 120 ms y un mínimo común de viewport en el shell.

## Capturas

Páginas y shell reales en Storybook, SDK sustituido por un mock local con promesas controladas. No se ha llamado a InsForge ni utilizado una sesión real. Las imágenes muestran datos pendientes; los fixtures poblados existen solo en las stories. Chromium headless, escritorio 1440×1000 y móvil 390×844, captura de página completa.

| Pantalla | 1440 | 390 |
|---|---|---|
| dashboard | [claro](dashboard-1440-light.png) · [oscuro](dashboard-1440-dark.png) | [claro](dashboard-390-light.png) · [oscuro](dashboard-390-dark.png) |
| trips | [claro](trips-1440-light.png) · [oscuro](trips-1440-dark.png) | [claro](trips-390-light.png) · [oscuro](trips-390-dark.png) |
| expenses | [claro](expenses-1440-light.png) · [oscuro](expenses-1440-dark.png) | [claro](expenses-390-light.png) · [oscuro](expenses-390-dark.png) |
| notes | [claro](notes-1440-light.png) · [oscuro](notes-1440-dark.png) | [claro](notes-390-light.png) · [oscuro](notes-390-dark.png) |

Inspección visual: héroe, columnas de presupuesto, filtros y lista/editor de notas conservan la composición adaptable. Papel/tinta cambian con el tema. Ningún desbordamiento horizontal ni error de JavaScript en las 32 ejecuciones.

## LayoutShift y movimiento

Comando ejecutado: `node scripts/qa-interior-skeletons.mjs`, código **0**. Resultado: **32 casos, suma de LayoutShift 0, 0 desbordamientos y 0 errores de JavaScript**.

El script espera las fuentes, mide `offsetHeight` de `[data-loading-frame]`, captura la espera y registra `PerformanceObserver` con `type: 'layout-shift'`. Resuelve el SDK mediante un evento sintético para no excluir desplazamientos como interacción reciente; espera dos frames antes de terminar la medición. Se prueba cada combinación de pantalla, tamaño y tema con respuesta vacía y poblada. El botón del arnés queda oculto en las capturas.

`prefers-reduced-motion: reduce`: `animation-name: none` en los 32 casos. Con `no-preference`: animación CSS `breathe` en los 32 casos. Las capturas se toman con movimiento reducido.

Datos completos, incluidos ambos temas y cada evento: [measurements.json](measurements.json). Alturas en píxeles para claro (oscuro produce los mismos valores):

| Pantalla | Ancho | Respuesta | Antes | Después | Diferencia | LayoutShift |
|---|---:|---|---:|---:|---:|---:|
| dashboard | 1440 | empty | 912 | 912 | +0 | 0 |
| dashboard | 1440 | populated | 912 | 912 | +0 | 0 |
| dashboard | 390 | empty | 1100 | 1157 | +57 | 0 |
| dashboard | 390 | populated | 1100 | 1285 | +185 | 0 |
| trips | 1440 | empty | 912 | 912 | +0 | 0 |
| trips | 1440 | populated | 912 | 912 | +0 | 0 |
| trips | 390 | empty | 825 | 712 | -113 | 0 |
| trips | 390 | populated | 825 | 712 | -113 | 0 |
| expenses | 1440 | empty | 912 | 912 | +0 | 0 |
| expenses | 1440 | populated | 912 | 912 | +0 | 0 |
| expenses | 390 | empty | 1010 | 726 | -284 | 0 |
| expenses | 390 | populated | 1010 | 838 | -172 | 0 |
| notes | 1440 | empty | 912 | 912 | +0 | 0 |
| notes | 1440 | populated | 912 | 945 | +33 | 0 |
| notes | 390 | empty | 749 | 751 | +2 | 0 |
| notes | 390 | populated | 749 | 712 | -37 | 0 |

La métrica verificada es LayoutShift, no igualdad de alturas: las listas, los textos y los vacíos tienen altura variable al resolver. La tabla conserva esas diferencias; estas muestras no garantizan la misma altura para cualquier cantidad de datos o texto. Los bloques de carga reservan la composición base y el shell mantiene su mínimo común de viewport.

## Gates

Ejecutados en Node `v24.20.0`, pnpm `12.3.4`, sin cambiar dependencias. El build se hizo con `.env.local` temporal: `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid` y `NEXT_PUBLIC_INSFORGE_ANON_KEY=placeholder`; fichero eliminado después del build, del validador y de Storybook (que también importa la validación de entorno público).

```text
$ pnpm run type-check
$ tsc --noEmit
exit: 0

$ pnpm run lint
✖ 13 problems (0 errors, 13 warnings)
exit: 0

$ pnpm exec jest --runInBand --coverage=false
Test Suites: 71 passed, 71 total
Tests:       521 passed, 521 total
exit: 0

$ pnpm run build
▲ Next.js 16.3.8 (Turbopack)
✓ Compiled successfully in 1574ms
✓ Generating static pages using 11 workers (22/22) in 927ms
○  (Static)  prerendered as static content
exit: 0

$ pnpm run validate:static-export
Validated 182 static files and 13 critical routes; no private key markers found.
exit: 0

$ pnpm run test:storybook
Test Files  11 passed (11)
Tests       50 passed (50)
exit: 0
```

Jest incluye primitivas, limpieza del temporizador, resolución antes de 120 ms, consulta SDK pendiente en nueve pantallas, espera de sesión en las doce y continuidad sesión→datos. Las stories incluyen las tres primitivas y ocho pantallas reales, con accesibilidad comprobada; perfil y ajustes también verifican la transición de la sesión al contenido final.

Incidencias durante la verificación: el baseline inicial de Jest falló en `FlightInspiration` (484 pruebas pasadas); las suites completas posteriores pasaron sin modificar ese componente. Next/Jest no pudo lanzar su comprobación de TypeScript dentro del sandbox, por lo que se ejecutó fuera del sandbox. Se corrigió el landmark `main` anidado del arnés de páginas. Una ejecución de Vitest con el servidor Storybook concurrente falló importando módulos; otra, después de retirar el entorno temporal, falló la validación de las variables públicas. Se repitió con el entorno ficticio y el gate final se ejecutó con ese servidor cerrado. Los 13 avisos de lint están fuera de los ficheros nuevos.

## Revisión independiente

Informe del subagente `reviewer`: «Sin hallazgos. No he identificado regresiones de producción ni problemas nuevos de accesibilidad demostrables».

Comando independiente:

```text
pnpm exec jest --runInBand --coverage=false src/app/interior-loading.test.tsx src/hooks/__tests__/useDelayedLoading.test.tsx src/components/ui/__tests__/Skeleton.test.tsx src/components/auth/__tests__/ProtectedRoute.test.tsx src/components/layout/__tests__/DashboardLayout.test.tsx src/app/trip/__tests__/page.test.tsx src/app/trips/__tests__/page.test.tsx
Test Suites: 7 passed, 7 total
Tests:       58 passed, 58 total
exit: 0

git diff --check
(sin salida)
exit: 0
```

Segunda revisión del mismo revisor: «Sin hallazgos. Valoración favorable». Ejecutó `pnpm exec jest --runInBand --coverage=false src/app/interior-loading.test.tsx src/app/tasks/__tests__/page.test.tsx`: `2 passed` suites, `44 passed` tests, código **0**, y validó por separado los 32 casos del JSON y los 16 PNG con código **0**. El gate completo final de Storybook terminó después de esa revisión con 50 pruebas pasadas y código **0**.

El revisor señaló que las alturas no son idénticas y un hueco del botón de resolución en las stories de perfil/ajustes. El primer límite se documenta arriba; el segundo se corrigió provocando una actualización de React y verificando las dos transiciones en Storybook.

## Reproducir la captura

Con las dos variables públicas ficticias del apartado Gates configuradas, ejecutar `pnpm run storybook` y, en otra terminal, `node scripts/qa-interior-skeletons.mjs`. Detener el servidor antes de `pnpm run test:storybook` para que ambos procesos no compartan la caché Vite durante las pruebas. El script devuelve código 1 ante un LayoutShift positivo, desbordamiento, error de JavaScript o movimiento que incumpla la preferencia.
