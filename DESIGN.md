# TravelPal — guía de continuidad visual

Actualizada el 16 de octubre de 2026. Leer junto con `CONTEXT.md` y
`docs/DECISIONS/ADR-008-atlas-claro.md`. ADR-008 sustituye ADR-007.
Este documento registra el sistema actual; no sustituye las issues de producto.

## Dirección aprobada

Atlas: una herramienta clara para preparar y seguir un viaje. La landing elegida
por Pablo el 13 de octubre tiene titular grande, azul de acción y una ilustración
mediterránea panorámica. Su referencia está en
`docs/design/assets/layout1-2026-10-13/reference.webp`.

Dentro de la app manda el trabajo del usuario: próximo viaje, días del itinerario,
tareas, importes y notas. Los títulos privados son más compactos que el titular
de marketing. No trasladar el paisaje ni la composición de la landing a cada
formulario o listado. Las imágenes de destinos deben corresponder a datos reales;
los ejemplos sintéticos se limitan a Storybook y tests.

## Marca

- La marca de TravelPal es la **ligadura TP** elegida el 19 de octubre de 2026 entre las seis
  propuestas de `docs/design/logo/proposals/`. Se apoya en una sola forma sólida —la `T` y la `P`
  comparten asta— y funciona a 16 px.
- Ficheros: `src/app/icon.svg` (icono de app y favicon, marca en blanco sobre `accent` `#0759d3`),
  `public/brand/travelpal-mark.svg` (marca suelta, hereda color con `currentColor`) y
  `public/brand/travelpal-lockup.svg` (marca + «TravelPal», con variante oscura por
  `prefers-color-scheme`).
- Usar la marca en un solo color cuando el fondo no sea papel claro: `currentColor` ya lo resuelve.
  No recolorearla con colores de estado ni meterla en degradados, sombras o contenedores decorativos.
- El wordmark en trazados está en `docs/design/logo/proposals/03-ligadura-tp-outlined.svg`; la
  versión de propuesta con `<text>` no debe usarse en superficies publicadas.

## Herramientas y contratos existentes

- Next.js 16, React 19, Tailwind 4; Inter para la interfaz. Fraunces sigue cargada
  por compatibilidad con superficies antiguas, no es la tipografía de nuevos módulos.
- Componentes locales de `src/components/ui`: `Button`, `Input`, `Card`,
  `PageTitle`, `EmptyState`, `ErrorState` y clases de campo compartidas.
- Headless UI para diálogos, Heroicons para iconos, Framer Motion donde existe
  interacción animada; dnd-kit, react-calendar y Recharts en sus módulos.
- shadcn/Base UI está decidido como incorporación progresiva, **no está instalado**
  a esta fecha. No describir los componentes locales como shadcn. Incorporar un
  control cuando aporte un contrato necesario; conservar los tokens y verificar
  teclado, foco, etiquetas y estados. No sustituir toda la base de diálogos de golpe.
- Storybook + Vitest en Chromium + axe para componentes; Jest para lógica/páginas;
  Playwright para rutas y flujos autenticados. No añadir otro framework de UI por estética.

## Reglas de composición

- Una cabecera `PageTitle` por página: título, explicación útil y acción principal.
  Controles de filtro después de ella; en móvil se apilan sin desbordar.
- `DashboardLayout`: fondo `surface`; contenido `paper`, borde `line`, radios de
  8–12 px. `Card` no se eleva al pasar el ratón. No anidar tarjetas solo para separar texto.
- Cabeceras privadas de 24–32 px, título de sección 18–20 px, cuerpo de 14–16 px.
  Inter, peso semibold para jerarquía; importes con cifras tabulares.
- Usar `ink`, `muted`, `accent`, `success`, `warning`, `danger` y sus superficies.
  El azul distingue acciones; los colores de estado comunican hechos. Categorías
  ordinarias se identifican por texto/icono, no mediante una paleta arcoíris.
- Acciones de editar accesibles y visibles sin hover; objetivos de al menos 44 px
  en los controles de tarjeta. No poner un botón dentro de un enlace.
- `CardTitle` permite `headingLevel`: usar nivel 2 bajo el título de página y nivel
  3 bajo una sección. Mantener un `h1` por ruta. El vacío compartido usa `h2`.
- Formularios: etiquetas enlazadas, clases `fieldStyles`, errores con `role=alert`,
  foco visible también en radios ocultos visualmente. Conservar validación y envío.
- Movimiento breve y ligado a estado: color/foco, apertura, progreso. Sin elevación,
  rotación ni entrada escalonada de cada tarjeta. Respetar `prefers-reduced-motion`.

## Estado por módulo tras esta pasada

| Módulo | Composición y cambios | Verificación que requiere sesión real |
|---|---|---|
| Dashboard | Próximo viaje antes del informe; cabecera y fondo compartidos | Viaje actual/futuro, filtros, errores y múltiples monedas |
| Viajes | Cabecera/estados compartidos; detalle conserva itinerario y diario, estado semántico claro/oscuro | Lista poblada, alta/edición/borrado, diario con fotos |
| Planificación | Cabecera compartida; categorías del planner neutras, reservas y calendario existentes | Crear/editar/reordenar actividades y reservas |
| Tareas | Columnas neutras con línea de estado; tarjetas sin sombra/rotación; selector móvil y cambio sin arrastre | Persistencia de estado, editar/borrar, lista larga |
| Gastos | Importe y descripción principales; edición visible, categoría neutra; formularios tokenizados y etiquetados | Alta/edición/borrado, recibos, filtros y distintas monedas |
| Presupuestos | Superficie coherente; acciones con nombre y tamaño táctil; filas adaptables | Totales, excedido y periodos. `/budget` redirige a `/expenses` |
| Notas | Título y texto antes de metadatos; edición visible con nombre; error semántico del editor | Guardado, categorías/favoritos/filtros. `/notes/[id]` redirige al listado |
| Perfil | Cabecera común, avatar más compacto, campos etiquetados y colores semánticos | Edición, cancelar, subida y fallo de avatar |
| Ajustes | Títulos de sección coherentes y jerarquía accesible | Tema automático, permisos push y estados de seguridad |

La verificación visual de esta pasada se hace sobre componentes reales con datos
sintéticos de Storybook. No equivale a una auditoría autenticada de todas las rutas.
Consultar `docs/qa/audits/2026-10-14-private-revamp.md` para evidencia y límites.

## Continuar en otro chat

1. Leer esta guía, ADR-008 y el último informe de QA; revisar `git status` y `git diff`.
   El trabajo puede seguir sin commit en un worktree; no asumir que está en `main`.
2. Confirmar el worktree y servidor activo antes de cambiar ficheros. No pisar cambios
   ajenos de gráficas, tests o auditorías. Elegir un módulo concreto y su flujo.
3. Capturar la ruta real a 1440 y 390 px, claro/oscuro, con vacío y datos de prueba.
   Usar un entorno/cuenta de prueba; nunca introducir datos demo en pantallas de producción.
4. Leer sus componentes/call sites y tests. Conservar servicios, sesión, RLS, rutas,
   conversiones monetarias y contratos de props. No inventar mapas, reservas ni totales.
5. Ejecutar Jest, TypeScript, lint y stories afectados; probar el flujo completo con
   Playwright. Guardar capturas y revisión independiente antes de afirmar cierre.
6. Actualizar el estado de este documento y el informe con comandos, salida y código
   de retorno. Una limitación de acceso se registra como bloqueo, no como prueba pasada.

Comandos base (variables de entorno de prueba, nunca claves reales en el informe):

```bash
pnpm run type-check
pnpm exec jest --runInBand --coverage=false
pnpm exec vitest run --project=storybook
pnpm run storybook
```

## Autenticación · opción 2 Mesa de viaje

Selección aprobada por Pablo el 16 de octubre: referencia autoritativa persistida
en `docs/design/assets/auth-mesa-2026-10-16/reference.png`. Signup y signin usan
una composición editorial: marca y enlace de cuenta arriba, gran titular y bodegón
de cuaderno a la izquierda, formulario directamente sobre papel a la derecha.
`AuthShell` recibe `mode="signup" | "signin"`; sin `mode` conserva la composición
previa de recuperación y restablecimiento. No reutilizar el mockup como fondo.

Inter y tokens Atlas existentes; controles locales y Heroicons. No se ha instalado
shadcn/Base UI ni otra biblioteca. Bordes de campos/Google derivados de `muted` y
`paper` para distinguir controles, errores con alertas y descripción asociada,
objetivos de contraseña de 48 px. Las contraseñas conservan reglas y fortaleza;
OTP mantiene pegado, foco, cooldown y reenvío. No cambian servicios, callbacks ni
sesiones. El enlace de cuenta pasa al pie del formulario y se repite en cabecera
de escritorio; en móvil se oculta toda la promoción y su imagen.

Asset nuevo: `public/images/atlas/auth-travel-notebook.webp`, gouache con alfa real.
Prompt y procedencia en el README de assets. El cuaderno cuadrado anterior se
conserva como exploración histórica. La nueva ilustración interpreta el bodegón
elegido; no representa un viaje real. Oscuro utiliza los mismos tokens semánticos.

QA de esta entrega: `docs/qa/audits/2026-10-16-auth-mesa/design-qa.md`. No confundir
con `design-qa.md` de raíz, que documenta exclusivamente la landing del 13 de octubre.

## Interior Atlas · diez pantallas aprobadas

Implementadas el 16–17 de octubre en el worktree `auth-brand-a11y/travelpal`: dashboard, viajes, alta de viaje, planificación, tareas, gastos, alta/edición de gasto, notas, perfil y ajustes. Referencias en `docs/design/proposals/interior-atlas-2026-10-16/`; la planificación usa el calendario corregido.

El shell privado fija papel/navy/azul, Inter, sidebar 240 px y títulos 28/38 px; conserva el WIP de autenticación y la landing. Composiciones abiertas, lista por estado en tareas, editor dividido de notas y resúmenes reactivos en formularios. Se mantienen calendario/tablero, informes, exportación y servicios reales. No añadir destinos, importes ni imágenes ficticias al código de producción.

QA autenticada sobre InsForge local aislado, con datos vacíos y poblados a 1440/390, claro/oscuro, más estados de edición: 96 vistas sin incidencias de axe ni desbordamiento horizontal. Jest 477 tests, Playwright 25, TypeScript, lint (13 avisos previos) y build OpenNext en Node 22.22.3 terminan con código 0. Evidencia, comparación visual y límites: `docs/qa/audits/2026-10-16-interior-atlas/design-qa.md`.

El reordenado de actividades escribe solo el orden con condiciones y compensación; no es una transacción de servidor. Las notas conservan la protección de cambios pendientes. No se han hecho commit, push ni deploy en esta entrega.
