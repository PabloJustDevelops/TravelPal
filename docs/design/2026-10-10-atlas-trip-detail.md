# Atlas: detalle del viaje

Continuación de ADR-008 y de la dirección 1 elegida por Pablo. Implementación delegada a GPT-6 Luna por petición expresa.

## Alcance

Cabecera con destino, fechas, estado y acciones existentes. Itinerario editable en la columna principal y resumen de gastos/reservas más información del viaje en el lateral. Una columna en móvil; dos en escritorio. Tokens Atlas, Inter, claro/oscuro, teclado y foco visible.

Se conservan editar, completar, eliminar, diario y las rutas existentes. El itinerario utiliza actividades reales filtradas por trip_id y sus operaciones existentes. Los gastos se muestran por moneda. Las tareas no tienen trip_id: el acceso a Tareas es una herramienta general y no una lista de pendientes atribuida al viaje. Sin fotos, mapas ni presupuestos inventados.

## Ejecución

- [x] Verificar contratos y composición con el implementador.
- [x] Integrar itinerario, carga/error/vacío y resumen con el detalle.
- [x] Corregir semántica de desplegables y modal del itinerario; comprobar el caller de planificación.
- [x] Ejecutar unitarias, tipos, lint, Storybook, E2E, TesterArmy y OpenNext.
- [x] Revisar capturas a 390 y 1440 px, claro/oscuro, con actividad persistida.
- [x] Revisión independiente; entrega preparada para el PR #92.

Evidencia: `docs/audits/2026-10-10-atlas-detalle-viaje.md`.

Baseline anterior: pnpm run test:ci --runInBand → 56 suites y 416 tests aprobados, código 0. No se añaden librerías ni migraciones de backend para esta entrega.
