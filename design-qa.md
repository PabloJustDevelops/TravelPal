# QA visual: Atlas

- Source visual truth: `docs/design/atlas-reference.png`, opción 1 seleccionada por Pablo.
- Implementation screenshot: `docs/audits/assets/atlas-light-1440.png`; móvil: `docs/audits/assets/atlas-light-390.png`.
- Source pixel dimensions: 1487×1058.
- Viewports de implementación: 1440×900 y 390×900, density 1. Capturas sin normalización.
- Estado: cuenta QA autenticada sin viajes, tema claro. El boceto muestra un viaje poblado a Lisboa. Los estados y encuadres no coinciden; no se declara comparación de fidelidad ni un resultado visual aprobado.

## Hallazgos pendientes del rediseño completo

- [P1] El hero fotográfico del boceto sigue pendiente. `Trip` no tiene una fuente de imagen por viaje; la pantalla usa datos reales y no muestra una foto genérica como si perteneciera al destino. La integración de itinerario, tareas generales y presupuestos ya está implementada con sus fuentes reales.
- [P2] Las gráficas y filtros de análisis permanecen debajo del contenido centrado en el próximo viaje. La captura de implementación anterior no representa esta composición y aún falta capturar y comparar la misma sesión/viewport.

## Superficies y evidencia

Inter y los colores azul/neutros se han aplicado al armazón. El ritmo de navegación y los controles se comprobaron en navegador y E2E. Las imágenes y composición final requieren una siguiente implementación; no se ha sustituido la imagen del boceto por arte CSS. El contenido proviene de la cuenta, con estado vacío real.

No se hizo una comparación combinada ni de regiones con el boceto poblado porque no se ha construido todavía ese estado completo. La validación funcional de la base (teclado, foco, notificaciones, axe y móvil) está documentada en `docs/audits/2026-10-10-atlas-base.md`; no sustituye el gate visual.

## Dashboard: integración de viaje, itinerario y presupuesto

La composición actual prioriza el próximo viaje real, sus actividades de `itinerary_activities`, tareas pendientes de la cuenta y presupuestos cuyo `trip_id` coincide con ese viaje. Las tareas son globales porque el modelo `tasks` no tiene `trip_id`; los presupuestos se muestran uno a uno en su moneda y no se suman entre divisas. Si no hay viaje, actividad, tarea o presupuesto se muestra un estado vacío real. La carga de actividades se limita al próximo viaje y los resultados de tareas quedan acotados.

Pruebas: `pnpm exec jest --runInBand --coverage=false` pasó 58 suites y 436 tests. Storybook verificó los estados poblado/oscuro/vacío y el viewport 390 × 844. Esta evidencia funcional no sustituye una captura del dashboard autenticado ni la comparación visual final. La captura previa `docs/audits/assets/atlas-light-1440.png` es una referencia de la implementación anterior, no una captura de esta etapa.

## Implementación pendiente

1. Añadir una fuente auténtica de imagen asociada al viaje antes de implementar un hero fotográfico.
2. Capturar el dashboard final con estado poblado real a 1440 × 900 y una vista a 390 × 900.
3. Comparar juntos los artefactos y regiones relevantes, corregir P0/P1/P2 y repetir. Hasta entonces no se declara fidelidad visual global.

## Detalle del viaje

El módulo de detalle e itinerario pasó QA funcional y visual en claro/oscuro a 390 y 1440 px. Se corrigió el recorte de acciones móvil y se verificaron creación, edición, recarga y borrado. Evidencia y capturas: `docs/audits/2026-10-10-atlas-detalle-viaje.md`. Esta comprobación por módulo no sustituye la comparación pendiente con el boceto del dashboard.

## Lista/alta y planificación

La lista y el alta conservan filtros, autenticación, validación de fechas y presupuesto parcial. Planning conserva sus consultas y mutaciones; calendario, tarjetas y formularios tienen historias y pruebas. La historia de reserva comprueba acciones dentro de un viewport de 390 × 844. Evidencia de esta etapa: `docs/audits/2026-10-11-atlas-planificacion.md`. El CI 38283748961 ejecutó los E2E autenticados del estado actual: 22 pruebas aprobadas. Sigue pendiente el gate visual global.

## Acceso público

El formulario de inicio de sesión se capturó en producción local a 1440 × 900 y 390 × 900; axe no reportó infracciones y ambas vistas no desbordan horizontalmente. Se corrigieron la región principal, el nivel del encabezado y el nombre accesible del botón de visibilidad de contraseña. Informe y capturas: `docs/audits/2026-10-12-signin-accessibility.md`. Esto solo cubre el flujo no autenticado; el estado del dashboard autenticado se documenta en la sección siguiente.

## Capturas autenticadas del estado actual

El CI 38283748961 generó ocho capturas nuevas del dashboard vacío y del detalle con actividad en claro/oscuro a 390/1440 px. Se descargaron e inspeccionaron: `docs/audits/2026-10-12-atlas-authenticated.md`. Confirman el alcance funcional actual y documentan oportunidades de compactación y ajustes de texto. La tarjeta vacía de itinerario ya se compactó; el dashboard poblado comparable con la referencia sigue pendiente, junto con las capturas de las demás superficies. La falta de credenciales locales ya no impide obtener evidencia de la cuenta dedicada mediante CI.

Los ajustes de singular y horas del itinerario se corrigieron el 13 de octubre con una regresión que primero falló. La tarjeta de itinerario vacía medía 398 px en Storybook; ahora mide 139 px en escritorio y 151 px en móvil, con una prueba que exige menos de 220 px. Evidencia: `docs/audits/2026-10-12-atlas-authenticated.md` y `docs/qa/audits/2026-10-13-global-ui-ux.md`. Verificación reciente: 61 suites/450 pruebas Jest, 8 ficheros/32 pruebas Storybook, 3 E2E públicos, type-check, lint y build aprobados. El dashboard poblado y la comparación con referencia continúan pendientes.

Estado QA global: pendiente de captura autenticada poblada y comparación visual con la referencia.
