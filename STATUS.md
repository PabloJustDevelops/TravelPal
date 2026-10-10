# Estado de TravelPal

## Base revisada

Revisión del 2026-10-10 sobre `main` / `origin/main` en `dd95e8e`, sin divergencia ni WIP.
Los issues #36, #38, #44, #65, #85 y #88 están cerrados en GitHub. Solo siguen abiertos #41 y #48.
Este documento registra esa revisión; no pretende fijar el SHA futuro de `main`.

El camino de datos de usuario es el SDK de InsForge en el navegador, con RLS. El BFF se retiró;
el servidor conserva las acciones de auth, `/api/auth/refresh` y `/api/auth/callback`
(ADR-009, ADR-012). La dirección «Cuaderno de viaje» está aplicada a fundamentos y componentes
compartidos (ADR-007); falta auditar la experiencia completa antes de elegir su evolución.

El rework de #44 ya fusionó presupuesto en gastos y analítica en el panel. Las rutas antiguas
redirigen; no son pantallas pendientes. La navegación conserva Dashboard, Tareas, Viajes,
Planificación, Gastos y Notas, además de Perfil y Configuración en el menú de usuario.

## Trabajo de esta rama

- CI prueba E2E del código antes del deploy y vuelve a comprobar producción después.
- Concurrencia por rama para CI y un turno global para las suites que comparten usuario.
- Tester Army complementa Playwright con acceso público en escritorio y viewport estrecho,
  sin modelo y con telemetría desactivada.
- Ajustes informa de que el envío de push no está disponible; conserva la baja de
  suscripciones anteriores y no ofrece nuevas altas mientras falta el backend.
- Documentación alineada con Next 16.3.8, las rutas actuales y los casos de borrado ya existentes.
- Auditoría manual de la app publicada con una cuenta aislada; hallazgos y plan de UX/QA en
  [la auditoría del 2026-10-10](docs/audits/2026-10-10-qa-y-plan-ux.md).

La verificación local y la ejecución remota de esta rama se registran en su PR, no se deducen
por la mera existencia de estos cambios.

## Pendientes de producto y QA

| Pendiente | Condición | Referencia |
|---|---|---|
| Inspiración de precios | Decidir su utilidad y disponer de cuenta/token de Travelpayouts | #41 |
| Envío real de push | Métrica de uso y presupuesto; tabla, deduplicación, emisor, schedule y secretos | #48 / ADR-013 |
| Cerrar hallazgos de UI/UX | Priorizar los defectos verificables antes de escoger dirección visual | auditoría del 2026-10-10 |
| Orientación del siguiente diseño | Revisar los hallazgos con el propietario | ADR-007 |

Las cifras históricas de usuarios de pruebas/OTPs y del advisor no se han vuelto a consultar
contra el backend en este pase. No deben usarse como estado actual. La limpieza de usuarios
creados por el E2E de registro sigue requiriendo un mecanismo de administración separado.
