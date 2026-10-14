# Auditoría global de UI/UX y QA — 13-10-2026

## Alcance y método

Revisión visual de portada, acceso y registro a 1440 × 900 y 390 × 844 px; recorrido autenticado en ventana de 858 × 768 px. Se inspeccionaron las pantallas en navegador y se ejecutó axe sobre las rutas públicas. Las capturas públicas están en `assets/`.

## Recorrido revisado

| Paso | Pantalla | Resultado observado |
| --- | --- | --- |
| 1 | Portada: hero y navegación | Rediseño con ilustración propia de ruta costera, acción principal clara y navegación móvil accesible. |
| 2 | Portada: funciones y secciones inferiores | Secciones Atlas más compactas; se retiraron testimonios de plantilla sin fuente verificable. |
| 3 | Inicio de sesión | Shell de autenticación coherente con la marca; formulario e ilustración propios se adaptan a móvil; axe sin infracciones. |
| 4 | Registro | Formulario largo con `h1`, controles de contraseña con nombre y estado accesibles, y composición responsive. |
| 5 | Dashboard vacío y poblado | Próximo viaje, tareas y presupuesto; se compactó la tarjeta de itinerario vacía. CI validó un dashboard poblado en móvil/escritorio y tema claro/oscuro. |
| 6 | Mis viajes vacío | Estado vacío compartido, sin búsqueda/filtros irrelevantes ni acción duplicada. |
| 7 | Nuevo viaje | Los campos opcionales de vuelo quedan dentro de una divulgación cerrada inicialmente. |
| 8 | Tareas y diálogo de nueva tarea | Instrucción para borrar solo se monta con tareas; las columnas vacías se compactan. El diálogo estaba correctamente centrado. |
| 9 | Planificación/calendario y notas | Estados vacíos claros y compactos, menos ruidosos que otras áreas. |
| 10 | Gastos y ajustes | Sin datos, las acciones aparecen primero y se ocultan métricas, gráficas y filtros vacíos. Tema automático, no se modificó. |

Dirección acordada: interfaz clara, azul/verde y centrada en el viaje, con itinerario y mapa como elementos principales.

## Hallazgos

| Prioridad | Hallazgo | Evidencia | Estado |
| --- | --- | --- | --- |
| Alta | Marca inconsistente: algunas pantallas conservaban textos y estética ajenos a TravelPal. | Capturas 01–08 y revisión de rutas públicas. | Landing y autenticación rediseñadas con Atlas; fotografías remotas genéricas y la ilustración antigua se retiraron. Se reemplazaron por recursos WebP propios en `public/images/atlas/`. |
| Alta | Registro no tenía landmark `main`; los botones iconográficos para revelar contraseña no tenían nombre accesible. Axe encontró `button-name` (critical), `landmark-one-main` y `region`. | `/signup`, axe antes del cambio; prueba `e2e/smoke/signup-accessibility.spec.ts`. | Corregido y probado localmente; axe sin violaciones en registro. |
| Alta | La tarjeta flotante del hero mantenía un fondo blanco translúcido en tema oscuro, con contraste insuficiente para texto claro. | Revisión independiente y prueba Playwright de estilos calculados/axe en tema oscuro. | Corregido con `bg-paper` y `border-line`; contraste y axe vuelven a comprobarse en E2E. |
| Media | Con cero viajes, la lista mostraba controles de búsqueda/filtro y dos acciones de creación simultáneas. | Recorrido autenticado, prueba de página. | Corregido; probado con Jest. |
| Media | Gastos mostraba gráficas sin datos antes de las acciones útiles. | Recorrido autenticado, prueba de página. | Corregido; probado con Jest. |
| Media | El tablero de tareas mostraba la papelera vacía y ocupaba demasiado espacio. | Recorrido autenticado, prueba de componente. | Corregido; probado con Jest. |
| Media | El formulario de viaje expandía detalles de vuelo opcionales en el flujo inicial. | Recorrido autenticado, prueba de página. | Corregido; divulgación cerrada por defecto, probada con Jest. |
| Media | Las gráficas del dashboard consumían demasiado alto en móvil. | Capturas 14 y 16, 390 px; prueba del componente y regresión E2E. | Altura móvil limitada a 220–280 px según categorías; conserva la altura configurada en escritorio. |
| Baja | Los estados vacíos de módulos distintos no comparten todavía un sistema visual completo. | Recorrido autenticado, pruebas de viajes/gastos/tareas. | Estado compartido aplicado en viajes y gastos; la unificación del resto queda dentro de la fase de fidelidad global. |

## Accesibilidad y límites

La pasada E2E analiza con axe `/`, `/signin`, `/signup`, `/forgot-password` y `/reset-password` a 390 y 1440 px, en claro y oscuro; no reporta infracciones ni desbordamiento horizontal. También comprueba carga de las ilustraciones, menú móvil, `h1`/`main` y los controles de visibilidad de contraseña. Esto no acredita cumplimiento WCAG completo.

El dashboard poblado se probó en CI con un usuario E2E dedicado. El flujo sembró viaje, actividad, tarea y presupuesto con valores sintéticos, comprobó limpieza al terminar y generó capturas en los cuatro casos de viewport y tema. No se usó una cuenta real ni se crearon datos de producción.

Las capturas 09 y 10 muestran la versión anterior del hero Atlas; la matriz nueva conserva capturas Playwright como artefactos de prueba. Las capturas no prueban el orden completo de foco, lectores de pantalla, zoom ni contraste en todos los estados. La auditoría no es una certificación WCAG.

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
- `assets/13-dashboard-poblado-claro-escritorio.png`
- `assets/14-dashboard-poblado-claro-movil.png`
- `assets/15-dashboard-poblado-oscuro-escritorio.png`
- `assets/16-dashboard-poblado-oscuro-movil.png`

## Pendiente de la fase de fidelidad visual global

La portada y autenticación ya usan la nueva dirección clara, con ilustraciones propias y sin las fotos genéricas previas. La verificación visual cubre las cinco rutas públicas en móvil/escritorio y ambos temas; falta revisar con el usuario la fidelidad visual global de los módulos autenticados y decidir la siguiente orientación. Los estados vacíos de módulos distintos aún no comparten un sistema visual completo. El dashboard poblado mantiene axe sin infracciones, no desborda horizontalmente en 390 px y sus gráficas ahora son compactas en móvil.

## Verificación ejecutada

- `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=test-anon-key INSFORGE_API_KEY=test-api-key pnpm run test:storybook` — 8 ficheros y 32 pruebas aprobados, código 0. Vitest imprimió un aviso de cierre tardío de proceso tras cerrar correctamente las pruebas.
- `gh run view 38431437151 --json status,conclusion,jobs` — `CI` completado con `success`; build, build de worker y job E2E pasaron. La suite E2E autenticada verificó cuatro combinaciones dashboard/tema/viewport, axe y limpieza; Tester Army reportó 6 pruebas públicas aprobadas para escritorio y viewport estrecho. El check separado `lint-commits` del PR falló por formato del mensaje del commit.
- Storybook midió la tarjeta de itinerario vacía en 139 px (1440 px) y 151 px (390 px); antes del cambio medía 398 px en escritorio y el límite de 220 px fallaba. Las capturas 11–12 corresponden al componente aislado, sin sesión ni datos de cuenta.
- `pnpm exec jest --runInBand --coverage=false` — 64 suites y 459 tests aprobados después del rediseño, código 0. Jest sigue mostrando avisos `act(...)` preexistentes en pruebas de formularios y gastos.
- `pnpm run type-check` — `tsc --noEmit`, código 0.
- `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=test-anon-key INSFORGE_API_KEY=test-api-key pnpm run build` — Next.js 16.3.8 compiló y generó las 24 rutas, código 0; se usaron valores locales ficticios.
- `NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder INSFORGE_API_KEY=qa-placeholder E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test e2e/smoke/landing-auth-layout.spec.ts e2e/smoke/signin-controls.spec.ts e2e/smoke/signup-accessibility.spec.ts --project=smoke --workers=1` — 25 pruebas aprobadas (25,5 s), código 0; cinco rutas × dos anchuras × dos temas, más controles de autenticación y axe.
- `pnpm exec jest --runInBand --coverage=false src/components/charts/__tests__/TripChart.test.tsx` — 3 pruebas aprobadas, código 0.
- `pnpm exec playwright test e2e/flows/dashboard-populated.spec.ts --list` — 4 escenarios detectados, código 0. La ejecución autenticada requiere las credenciales E2E disponibles en CI.
- `pnpm exec eslint` sobre los ficheros modificados — código 0; quedan tres advertencias preexistentes en `TripChart.tsx` (estado actualizado dentro de un efecto y dos valores sin uso).
