# Atlas: planificación, calendario y reservas

Continuación de ADR-008 y de la dirección clara elegida. Esta etapa aplica el sistema Atlas a las vistas de calendario, itinerario y reservas, y a sus tarjetas y formularios.

## Alcance

- Se conservan las consultas autenticadas de viajes, reservas y actividades, sus mutaciones y rutas.
- Los selectores de vista son controles accesibles; el calendario mantiene sus interacciones de ratón, tacto y teclado y evita desplazar horizontalmente toda la pantalla en móvil.
- Reservas y formularios usan tokens semánticos, campos etiquetados y acciones táctiles de 44 px.
- Sin viajes, la vista de reservas enlaza al alta de viaje y no presenta una reserva sin asociación.
- `PendingAt390px` fija el viewport del navegador a 390 × 844 y mide la posición/tamaño de las acciones de la reserva.

## Ejecución

- [x] Revisar los contratos del SDK, el calendario y el consumidor del itinerario en el detalle.
- [x] Añadir regresiones de teclado, controles de vista, calendario y reservas.
- [x] Corregir el botón Eliminar recortado en una tarjeta de reserva estrecha.
- [x] Ejecutar Jest, type-check, lint, build y tests de Storybook.
- [x] Revisión independiente de CRUD, accesibilidad, diseño móvil y viewport real de la historia.

Evidencia: `docs/audits/2026-10-11-atlas-planificacion.md`. La verificación E2E autenticada de la página completa queda ligada al CI de la rama de PR; el build/story/tests locales no la sustituyen.
