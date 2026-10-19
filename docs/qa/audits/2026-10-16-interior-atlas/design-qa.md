# Interior Atlas · QA del 16–17 de octubre de 2026

Diez propuestas aprobadas implementadas en `/home/pablorg/.codex/worktrees/auth-brand-a11y/travelpal`, rama `codex/auth-brand-a11y`, base `c0ef4bd65c5a62eedd41a90626a8a2b7963a714f`. El trabajo queda sin commit, push ni deploy. Se conserva el WIP previo de autenticación y la landing.

## Pantallas y flujos

| Pantalla | Composición y capacidades |
|---|---|
| Dashboard | Próximo viaje, planes, tareas y presupuesto contextual. Informe desplegable y exportación JSON/PDF conservados. |
| Viajes | Próximo viaje destacado, filas, búsqueda y filtros. Detalle, edición, borrado seguro, diario y fotos conservados. |
| Crear viaje | Destino/fechas, detalles y resumen reactivo; vuelo opcional. Viajeros se mantiene en notas y presupuesto inicial en EUR, sin nuevo esquema. |
| Planificación | Agenda diaria, controles para reordenar, calendario mensual y reservas contextuales; mantiene calendario general y vista de reservas. |
| Tareas | Lista por estado, prioridad, vencimiento, búsqueda y cambio sin arrastre; tablero y calendario conservados. |
| Gastos | Movimientos con importe/divisa, presupuestos laterales e informe desplegable; un presupuesto no repite el mismo resumen agregado. |
| Añadir/editar gasto | Importe primero, categoría, fecha, viaje, notas y resumen reactivo. |
| Notas | Lista/editor, favoritos persistidos, filtros, Markdown seguro y protección del borrador al cambiar, cerrar o navegar. |
| Perfil | Foto y datos abiertos; edición/cancelación, subida y guardado existentes. |
| Ajustes | Claro/oscuro/automático, notificaciones y recuperación de contraseña existentes. |

Inter, Heroicons y tokens privados papel/navy/azul. Sidebar normalizada a 240 px, títulos 28/38 px. Sin nueva biblioteca UI, migraciones ni cambios de despliegue. Los estilos privados se limitan al shell de DashboardLayout. `/budget` redirige a gastos; `/analytics` y `/alerts` al dashboard.

## Comparación visual

Referencias: los diez PNG de `docs/design/proposals/interior-atlas-2026-10-16/`, incluido `04-planificacion.png` corregido. `comparisons/01-dashboard.webp` a `10-ajustes.webp` muestran referencia a la izquierda y aplicación real a la derecha, normalizadas a 720 × 512 por mitad. La captura real corresponde a 1440 × 1024. `comparisons/mobile-light.webp` y `mobile-dark.webp` reúnen las diez vistas de 390 px.

Se revisaron también las capturas completas. Se corrigieron calendario mensual sin estilos, hueco decorativo del viaje destacado, título duplicado en notas, columnas implícitas en perfil y ancho del campo de avatar. Las diferencias deliberadas responden al producto real: no se representa una imagen inventada de destino, ni se incrustan Ana/Lisboa/900/420 del boceto. Los resúmenes laterales se colocan después del formulario en móvil y los informes existentes permanecen accesibles.

## Entorno y evidencia visual

App `http://127.0.0.1:3011`, InsForge local aislado `http://localhost:7140`. Cuenta sintética y fixtures de Granada; no se escribió en el backend cloud. El reinicio borró `/tmp`; se restauraron los bind mounts públicos de los contenedores y se regeneró toda esta evidencia. Las credenciales se usan únicamente en memoria del proceso, sin imprimirlas ni guardarlas en el repo.

La fase vacía comprueba cero filas para viajes, gastos, tareas, notas, presupuestos, reservas y actividades del usuario de QA antes de capturar. Después se crean 3 viajes, 3 tareas, 3 actividades, 1 presupuesto, 3 gastos, 1 reserva y 3 notas mediante el SDK y RLS del usuario.

- 40 vistas vacías: diez rutas × 1440/390 × claro/oscuro.
- 40 vistas pobladas con la misma matriz.
- 16 estados adicionales: formularios rellenados de viaje/gasto, itinerario seleccionado y perfil en edición × tamaños/temas.

Axe analiza `main` y navegación; se comprueba además desbordamiento horizontal. Resultados completos: `empty-results.json`, `populated-results.json`, `states-results.json`. Capturas reales en `screenshots/`, dimensiones y SHA-256 en `manifest.json`. Los WebP son conversiones de PNG del navegador.

## Comandos y resultados

```text
$ pnpm run type-check
$ tsc --noEmit
exit: 0
```

```text
$ pnpm run lint
  75 |     return () => mediaQuery.removeEventListener("change", handleChange);  react-hooks/set-state-in-effect

✖ 13 problems (0 errors, 13 warnings)
exit: 0
```

```text
$ pnpm exec jest --runInBand --coverage=false
PASS src/__tests__/test-environment.test.ts

Test Suites: 67 passed, 67 total
Tests:       477 passed, 477 total
Snapshots:   0 total
Time:        39.077 s
Ran all test suites.
exit: 0
```

```text
$ pnpm run test:timezone
    ✓ no atribuye actividades ni presupuestos si no hay un viaje próximo (8 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        1.523 s
Ran all test suites matching /src\/components\/dashboard\/__tests__\/NextTrip.test.tsx/i.
exit: 0
```

```text
$ node /home/pablorg/.cache/travelpal-interior-qa-20261017/run.cjs pnpm exec playwright test e2e/flows --project=flows --workers=1
  ✓  25 [flows] › e2e/flows/trips.spec.ts:30:7 › flujo de viajes › crear un viaje lo deja en la lista con sus datos (2.9s)

  25 passed (1.6m)
exit: 0
```

```text
$ fnm exec --using 22.22.3 node /home/pablorg/.cache/travelpal-interior-qa-20261017/run.cjs pnpm exec opennextjs-cloudflare build
Worker saved in `.open-next/worker.js` 🚀

OpenNext build complete.
exit: 0
```

```text
$ node /home/pablorg/.cache/travelpal-interior-qa-20261017/capture.cjs empty
QA empty: 40 views + 0 interaction states; 0 failures
exit: 0
```

```text
$ node /home/pablorg/.cache/travelpal-interior-qa-20261017/capture.cjs populated
QA populated: 40 views + 16 interaction states; 0 failures
exit: 0
```

`node scripts/check-data-paths.mjs` → `OK: sin puntos nuevos en el camino bff.`, código 0.

`git diff --check` → sin salida, código 0. Escaneo estático de líneas añadidas: `0 matches across 52 files`, código 0. No hubo aciertos que remitir a seguridad.

Los comandos se ejecutan desde el worktree. `run.cjs` carga la configuración exclusivamente del contenedor local y ejecuta el subproceso indicado. Los scripts de esta sesión están en `/home/pablorg/.cache/travelpal-interior-qa-20261017/`; los resultados durables quedan en este directorio.

## Revisión independiente y correcciones

Revisión read-only independiente del diff. Se corrigieron y probaron tres hallazgos: seleccionar la misma nota mantiene la protección del borrador; añadir reserva desde el itinerario preselecciona ese viaje; reordenar modifica solo `order_index`, condicionado al valor previo, sin recrear filas ni sobrescribir otros campos. La prueba cubre un fallo en la segunda escritura y la compensación de la primera.

La revisión final del perfil y los enlaces Cancelar no encontró hallazgos. Ejecutó además los tests de alta/edición de gastos: `pnpm exec jest --runInBand --coverage=false --runTestsByPath src/app/expenses/new/__tests__/page.test.tsx 'src/app/expenses/[id]/edit/__tests__/page.test.tsx'` → `2 passed`, `18 passed`, código 0.

Se reprodujo contraste de aproximadamente 1.2:1 al reutilizar el botón primario Editar como Cancelar y animar sus colores. Se quitó esa transición en ambas acciones; el E2E nuevo comprueba contraste inmediato y cancelación del borrador en los cuatro tamaños/temas. Los enlaces Cancelar de gastos ya no contienen botones anidados.

## Límites y avisos

El reordenado usa escrituras condicionales con compensación, sin transacción de servidor. No se ha simulado una caída de red durante la propia compensación; ante error se recarga el itinerario y se muestra el fallo. No se amplió el esquema para cambiar ese contrato.

La auditoría automática cubre las rutas y estados descritos; no equivale a certificar toda WCAG. No se probó entrega SMTP ni permisos push de todos los navegadores. El build verifica compilación para Workers; no es un despliegue ni una prueba en producción.

Lint conserva 13 avisos y cero errores, igual que el baseline inicial. El build puede emitir avisos de dependencias empaquetadas y de la fecha de compatibilidad existente; se conserva su salida y código de retorno. No hay cambios en la configuración de hosting.

El control de la pestaña del navegador integrado fue rechazado por la política de la herramienta tras reanudar la sesión. No se intentó sortear ese bloqueo; las capturas y E2E se ejecutaron en el contexto de pruebas autorizado. La app local se vuelve a dejar en el puerto 3011.
