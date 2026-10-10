# Atlas: detalle del viaje e itinerario

Implementación y dos rondas de correcciones delegadas a GPT-6 Luna, por petición de Pablo. Revisión independiente en un contexto de solo lectura. Esta entrega amplía el PR #92; sigue dependiendo del PR #91 y no está desplegada.

## Cambio

El detalle presenta el viaje, fechas y acciones en una cabecera, el itinerario editable como contenido principal y el resumen de gastos/reservas en un lateral. En móvil se dispone en una columna. Se conservan editar/completar/eliminar el viaje, información del vuelo, notas y diario. Los estados de itinerario incluyen carga, error recuperable y vacío.

Las actividades se leen por trip_id y utilizan inserción, actualización y borrado con comprobación de filas afectadas. Los costes se separan por moneda, sin inventar conversiones. Tareas sigue siendo una lista general: se enlaza a ella y no se atribuyen sus registros al viaje.

El formulario usa Dialog de Headless UI, etiquetas por instancia, Escape y retorno de foco. Los días se expanden con el botón compartido y aria-expanded. Los controles Editar/Eliminar de actividad se separan en móvil, miden al menos 44 px y permanecen dentro de la pantalla.

## Evidencia ejecutada

| Comando | Salida real relevante | Código |
| --- | --- | --- |
| `pnpm run test:ci --runInBand` | Test Suites: 57 passed; Tests: 422 passed | 0 |
| `pnpm run type-check` | tsc --noEmit, sin diagnósticos | 0 |
| `pnpm run lint` | 23 problems (0 errors, 23 warnings) | 0 |
| `pnpm run test:timezone` | 1 suite, 5 tests passed | 0 |
| `pnpm run test:e2e` con credenciales QA en el entorno | 21 passed (1.5m) | 0 |
| `pnpm run test:tester` con credenciales QA en el entorno | 2 files, 6 passed | 0 |
| `pnpm run build-storybook` | Storybook build completed successfully | 0 |
| `pnpm run test:storybook` | 5 files, 19 passed; también con caché fría | 0 |
| `PATH='/tmp/travelpal-node22/node-v22.22.3-linux-x64/bin:'"$PATH" pnpm exec opennextjs-cloudflare build` | Worker saved; OpenNext build complete | 0 |
| `node scripts/check-data-paths.mjs` | OK: sin puntos nuevos en el camino bff | 0 |
| `git diff --check` | sin salida | 0 |

Las cuatro variantes nuevas de Playwright cubren creación, edición, recarga y borrado de una actividad, etiquetas, Escape/foco, axe completo en main y diálogo, ausencia de desbordamiento y límites/tamaño de ambas acciones. Los tests anteriores de planificación, resumen de gastos, eliminación de viajes y diario siguen dentro de la suite completa. Los fixtures se eliminan en finally.

## Defectos reproducidos y corregidos

- Jest detectó un botón nativo fuera del sistema compartido: se sustituyó por Button sin ampliar la lista de excepciones.
- Axe detectó heading-order y contraste 2,34:1 en oscuro: se corrigieron los niveles y los tokens; las cuatro variantes pasan sin desactivar reglas.
- Storybook descubría date-fns y zod durante la ejecución y recargaba tests: se declararon en optimizeDeps junto a next/link. La historia ahora comprueba el foco en el disparador real del diálogo.
- La inspección visual descubrió Eliminar recortado a 390 px. La prueba añadida falló antes del arreglo: Expected <=390, Received403, código 1. Tras separar las acciones, la suite completa pasa y las capturas muestran ambos controles.

Revisión final: sin hallazgos abiertos. Las pruebas del adaptador incluyen crear, actualizar, eliminar y reintentar una carga fallida.

## Capturas revisadas

Datos del usuario dedicado de QA, con títulos deliberadamente largos para comprobar el layout:

- [Claro móvil](assets/atlas-trip-light-390.png).
- [Oscuro móvil](assets/atlas-trip-dark-390.png).
- [Claro escritorio](assets/atlas-trip-light-1440.png).
- [Oscuro escritorio](assets/atlas-trip-dark-1440.png).

El navegador de Codex también comprobó la expansión del primer día del catálogo y dos monedas separadas. Su consola no registró errores durante esa comprobación del catálogo; esto no acredita ausencia de errores en toda la app.

## Límites y próximos módulos

No es el rediseño completo del boceto. El gate de fidelidad global de design-qa.md sigue bloqueado: falta terminar el dashboard y migrar los otros flujos. La siguiente etapa continúa con planificación/lista de viajes, gastos y tareas como módulos completos.

Permanecen 23 avisos de lint anteriores y el aviso de recursos abiertos de Vitest tras 10 segundos, con código 0. OpenNext muestra avisos de dependencias compiladas ya existentes. Se observaron ECONNRESET del servidor durante E2E, aunque la última suite terminó con 21 aprobados; no se declara una reparación del backend. El registro smoke actual sigue creando una cuenta pendiente de verificación, limitación ya documentada.
