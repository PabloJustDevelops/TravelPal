# Migración a pnpm y primera entrega de accesibilidad

## Cambios

PR #89 fusionado en `d9b6b4319957eca7584d28bf19589680bfebed73`. Su ejecución de CI
38067790959 terminó con build, worker, E2E del código, deploy y E2E de producción aprobados.
Consulta: `gh run view 38067790959 --json status,conclusion,jobs` (código 0; conclusion success).

La importación con `pnpm import` mantuvo las 45 versiones directas del lockfile npm inicial.
Después se añadieron dependencias de desarrollo para Storybook/Vitest y se alineó
`@types/node` con Node 22. CI, caché y lanzadores de ambos runners usan pnpm 12.3.4;
OpenNext reconoce el gestor a partir del único lockfile, `pnpm-lock.yaml`.

Tareas asocia sus cinco etiquetas con ids por instancia, anuncia el error obligatorio y da
nombre al botón de alta cuando su texto se oculta en móvil. Notas asocia contenido y viaje,
agrupa los radios con fieldset/legend y muestra foco visible. Sus colores usan tokens del tema.
El error oscuro cambiaba a un contraste inferior a 4.5:1; se ajustó el token `danger`.

Storybook 10.6.1 muestra botón y formularios en ambos temas, con fixtures sintéticos. Vitest
4.1.11 y Vite 7.3.7 se limitan al catálogo; Jest sigue ejecutando la suite de la aplicación.
Las violaciones de axe de las stories son errores. El catálogo no se publica con el Worker.

## Evidencia local

| Comando | Salida comprobada | Código |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Lockfile is up to date, resolution step is skipped | 0 |
| `pnpm peers check` | No peer dependency issues found | 0 |
| `pnpm run lint` | 23 problems (0 errors, 23 warnings), misma línea base | 0 |
| `pnpm run type-check` | tsc --noEmit, sin errores | 0 |
| `pnpm run test:ci --runInBand` | 54 suites, 408 tests passed | 0 |
| `pnpm run test:e2e` con credenciales de QA en el entorno | 13 passed; incluye cuatro combinaciones tema/viewport | 0 |
| `pnpm run test:tester` | 6 passed, escritorio y viewport estrecho | 0 |
| `pnpm exec opennextjs-cloudflare build` | OpenNext build complete; Worker saved | 0 |
| `pnpm run build-storybook` | Storybook build completed successfully | 0 |
| `pnpm run test:storybook` | 3 files, 12 tests passed | 0 |
| `node scripts/check-data-paths.mjs` | OK: sin puntos nuevos en el camino bff | 0 |
| `git diff --check` | sin salida | 0 |

Las credenciales no se incluyen aquí. La comprobación de Storybook también se ejecutó con el
binario oficial de Node 22.22.3 (SHA256 contrastado con SHASUMS256.txt), igual que en CI.
En el navegador se comprobó el tema oscuro de Notas: papel rgb(20,18,15), tinta
rgb(239,233,222) y fuente Inter.

## Fallos observados y límites

- Las pruebas nuevas reprodujeron etiquetas no asociadas y contraste insuficiente antes de
  corregirlos. En claro, axe también medía la transición de entrada: ahora espera al estado
  estable del diálogo, sin desactivar reglas.
- Una ejecución completa falló al crear el viaje de Planificación por un error 500 del backend
  (`socket hang up`). La repetición completa pasó las 13 pruebas. No se añadió retry para
  esconderlo ni se atribuye su causa a pnpm.
- Vitest finaliza con código 0 y las 12 pruebas aprobadas, pero avisa de recursos abiertos y
  espera diez segundos al cerrar, tanto en Node 24 como en 22. El diagnóstico hanging-process
  señaló filehandles y recursos de resolución de Vite. Queda como limitación del runner.
- Quedan los 23 avisos de lint previos; no se hizo una actualización masiva de dependencias ni
  se acredita remediación de las vulnerabilidades transitivas previamente registradas.
- El smoke de signup sigue creando una cuenta sin verificar. No se han añadido escrituras
  al backend en las pruebas nuevas de formularios.
- La elección visual, la migración a componentes shadcn/Base UI, el tablero móvil, la regla
  multimoneda y los baselines visuales quedan en el plan por módulos. Los tres conceptos
  generados son propuestas, no pantallas implementadas.

## Estado posterior

PR #91: CI 38069467866 completado con conclusion success. Pablo seleccionó la opción 1 después de esta auditoría; la primera base se documenta en `2026-10-10-atlas-base.md` y ADR-008. Las cifras y colores de la tabla anterior corresponden a la entrega de infraestructura previa a Atlas.
