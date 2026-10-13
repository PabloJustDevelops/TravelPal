# Auditoría global de UI/UX y QA — 13-10-2026

## Alcance y método

Revisión visual de portada, acceso y registro a 1440 × 900 y 390 × 844 px; recorrido autenticado en ventana de 858 × 768 px. Se inspeccionaron las pantallas en navegador y se ejecutó axe sobre las rutas públicas. Las capturas públicas están en `assets/`.

## Recorrido revisado

| Paso | Pantalla | Resultado observado |
| --- | --- | --- |
| 1 | Portada: hero y navegación | Hero Atlas claro, acción azul, fotografía de destino y menú móvil accesible. |
| 2 | Portada: funciones y secciones inferiores | Tarjetas se apilan en móvil; bloques altos con bastante espacio vertical. |
| 3 | Inicio de sesión | Formulario se adapta a móvil ocultando la foto lateral; axe sin infracciones. |
| 4 | Registro | Formulario largo; marca alineada y controles de contraseña con nombre y estado accesibles. |
| 5 | Dashboard vacío | Próximo viaje, tareas y presupuesto con estados vacíos; se compactó la tarjeta de itinerario vacía. |
| 6 | Mis viajes vacío | Estado vacío compartido, sin búsqueda/filtros irrelevantes ni acción duplicada. |
| 7 | Nuevo viaje | Los campos opcionales de vuelo quedan dentro de una divulgación cerrada inicialmente. |
| 8 | Tareas y diálogo de nueva tarea | Instrucción para borrar solo se monta con tareas; las columnas vacías se compactan. El diálogo estaba correctamente centrado. |
| 9 | Planificación/calendario y notas | Estados vacíos claros y compactos, menos ruidosos que otras áreas. |
| 10 | Gastos y ajustes | Sin datos, las acciones aparecen primero y se ocultan métricas, gráficas y filtros vacíos. Tema automático, no se modificó. |

Dirección acordada: interfaz clara, azul/verde y centrada en el viaje, con itinerario y mapa como elementos principales.

## Hallazgos

| Prioridad | Hallazgo | Evidencia | Estado |
| --- | --- | --- | --- |
| Alta | Marca inconsistente: algunas pantallas conservaban textos y estética ajenos a TravelPal. | Capturas 01–08 y revisión de rutas públicas. | Marca/títulos corregidos y hero migrado a Atlas claro. La composición de autenticación y la fidelidad visual global siguen pendientes. |
| Alta | Registro no tenía landmark `main`; los botones iconográficos para revelar contraseña no tenían nombre accesible. Axe encontró `button-name` (critical), `landmark-one-main` y `region`. | `/signup`, axe antes del cambio; prueba `e2e/smoke/signup-accessibility.spec.ts`. | Corregido y probado localmente; axe sin violaciones en registro. |
| Alta | La tarjeta flotante del hero mantenía un fondo blanco translúcido en tema oscuro, con contraste insuficiente para texto claro. | Revisión independiente y prueba Playwright de estilos calculados/axe en tema oscuro. | Corregido con `bg-paper` y `border-line`; contraste y axe vuelven a comprobarse en E2E. |
| Media | Con cero viajes, la lista mostraba controles de búsqueda/filtro y dos acciones de creación simultáneas. | Recorrido autenticado, prueba de página. | Corregido; probado con Jest. |
| Media | Gastos mostraba gráficas sin datos antes de las acciones útiles. | Recorrido autenticado, prueba de página. | Corregido; probado con Jest. |
| Media | El tablero de tareas mostraba la papelera vacía y ocupaba demasiado espacio. | Recorrido autenticado, prueba de componente. | Corregido; probado con Jest. |
| Media | El formulario de viaje expandía detalles de vuelo opcionales en el flujo inicial. | Recorrido autenticado, prueba de página. | Corregido; divulgación cerrada por defecto, probada con Jest. |
| Baja | Los estados vacíos de módulos distintos no comparten todavía un sistema visual completo. | Recorrido autenticado, pruebas de viajes/gastos/tareas. | Estado compartido aplicado en viajes y gastos; la unificación del resto queda dentro de la fase de fidelidad global. |

## Accesibilidad y límites

La pasada E2E analiza con axe `/`, `/signin`, `/signup`, `/forgot-password` y `/reset-password`; no reporta infracciones. También verifica tema oscuro en el hero, el menú móvil expandible y el ancho del documento. En esta pasada se corrigieron además los encabezados de recuperación/restablecimiento y los nombres de los controles de visibilidad de contraseña en restablecimiento. Esto no acredita cumplimiento WCAG completo.

Las rutas autenticadas se inspeccionaron visualmente en la sesión de navegador, pero sus capturas no se exportaron: la sesión mostraba información de cuenta. No se almacenaron ni incluyeron esos datos. No se creó ni modificó información de usuario. No se pudo revisar el detalle de un viaje con datos porque no había uno disponible y se evitó crear datos en producción.

Las capturas 09 y 10 muestran el hero actualizado a 1440 × 900 y 390 × 844. Las capturas no prueban el orden completo de foco, lectores de pantalla, zoom ni contraste en todos los estados. La auditoría no es una certificación WCAG.

## Capturas públicas de referencia

Las capturas 01–08 muestran la línea base anterior. Las capturas 09–10 muestran el hero tras el cambio.

- `assets/01-portada-hero-desktop.png`
- `assets/02-portada-funciones-desktop.png`
- `assets/03-portada-hero-movil.png`
- `assets/04-portada-funciones-movil.png`
- `assets/05-acceso-desktop.png`
- `assets/06-acceso-movil.png`
- `assets/07-registro-desktop.png`
- `assets/08-registro-movil.png`
- `assets/09-portada-redisenada-escritorio.png`
- `assets/10-portada-redisenada-movil.png`
- La regresión de tema oscuro se valida por estilos calculados y axe; no se adjunta captura adicional.
- `assets/11-dashboard-vacio-compacto-escritorio.png`
- `assets/12-dashboard-vacio-compacto-movil.png`

## Pendiente de la fase de fidelidad visual global

La portada y algunos estados internos ya usan Atlas claro. Quedan la composición global de autenticación, coherencia tipográfica entre secciones, unificación de estados vacíos y comparación del dashboard poblado frente a la referencia. Las nuevas capturas de dashboard son del estado vacío del componente Storybook, no del flujo autenticado completo; no se dará por equivalente ese estado al viaje poblado.

## Verificación ejecutada

- `pnpm exec jest --runInBand --coverage=false` — salida: 61 suites y 450 tests aprobados, código 0. Jest emitió avisos existentes de React `act(...)` en tests de gastos, formulario de viaje y autenticación.
- `pnpm run type-check` — salida: `tsc --noEmit`, código 0.
- `pnpm exec eslint` sobre los ficheros modificados — sin salida de error, código 0.
- `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=test-anon-key INSFORGE_API_KEY=test-api-key pnpm run build` — build de Next.js y generación de rutas completados, código 0. Se usaron valores ficticios locales; no se accedió al backend.
- `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=test-anon-key INSFORGE_API_KEY=test-api-key pnpm exec playwright test e2e/smoke/signup-accessibility.spec.ts --project=smoke` — 4 pruebas aprobadas, código 0. Incluye regresión de contraste del hero oscuro. Las variables son valores ficticios locales para arrancar la app; no se accedió al backend.
- `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=test-anon-key INSFORGE_API_KEY=test-api-key pnpm run test:storybook` — 8 ficheros y 32 pruebas aprobados, código 0. Vitest imprimió un aviso de cierre tardío de proceso tras cerrar correctamente las pruebas.
- Storybook midió la tarjeta de itinerario vacía en 139 px (1440 px) y 151 px (390 px); antes del cambio medía 398 px en escritorio y el límite de 220 px fallaba. Las capturas 11–12 corresponden al componente aislado, sin sesión ni datos de cuenta.
