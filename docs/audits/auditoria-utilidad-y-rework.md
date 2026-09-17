# Auditoría de utilidad de las secciones y propuesta de rework funcional

> Fecha: 2026-09-15. Alcance: `src/app` (22 rutas), `src/components` (55 ficheros), `src/app/api`
> (13 rutas), el esquema de `migrations/20260913181842_create-app-schema.sql`.
> Método: conteo sobre el árbol, lectura de las páginas y de sus consultas reales, y grep de
> quién enlaza a quién. Sin opiniones sin evidencia al lado.
> Issue con la propuesta en forma de spec: #44.

## Pregunta

¿Son **realmente útiles** las secciones de esta app? Con un rework funcional completo encima de la
mesa, ¿qué se queda, qué se fusiona y qué se va?

## Cifras de partida

| Métrica | Valor |
|---|---|
| Rutas de página (`page.tsx`) | **22** |
| Líneas de esas páginas | **6.441** |
| Páginas públicas (landing + auth) | 6 |
| Páginas privadas | 16 |
| Rutas de API | 13 ficheros (1.283 líneas) |
| Componentes bajo `src/components` | 55 |
| Tablas del esquema | 12 |
| **Tablas que nadie escribe ni lee** | **2** (`reminders`, `calendar_events`) |
| Ficheros de código muerto confirmado | 3 (`insforge-functions.ts`, `trips/TripCard.tsx`, y los dos anteriores) |
| Uso de `alerts`: `insert` | **0** (solo `select`, `update is_read`, `delete`) |

## Inventario y etiquetas

Etiquetas: **IMPRESCINDIBLE** · **UTIL PERO SECUNDARIA** · **REDUNDANTE CON OTRA** · **HUÉRFANA**.

### Cara pública

| Sección | Fichero (líneas) | Datos | ¿En nav? | Etiqueta |
|---|---|---|---|---|
| Landing `/` | `app/page.tsx` 27 + `landing/*` 531 | ninguno (estático) | sí (destino del logo) | **IMPRESCINDIBLE** |
| Entrar `/signin`, `/signup`, `/login` | 46 + 55 + 5 | auth (InsForge) | sí (landing) | **IMPRESCINDIBLE** |
| Recuperar contraseña `/forgot-password`, `/reset-password` | 59 + 61 | auth | desde el login | **IMPRESCINDIBLE** |

La landing es el escaparate y no toca base de datos: 531 líneas de componentes estáticos. Es la
superficie más barata de mantener y la única que ve quien no es usuario.

### Núcleo privado

| Sección | Fichero (líneas) | Datos reales (tabla → campos) | ¿En nav? | Etiqueta |
|---|---|---|---|---|
| Panel `/dashboard` | 452 | `trips(*)`, `expenses(*)`, `budgets(total_amount)` vía `/api/dashboard` | sí | **IMPRESCINDIBLE como entrada**, **REDUNDANTE en datos** con `/analytics` |
| Viajes `/trips` | 238 | `trips(*)` vía `/api/trips` | sí | **IMPRESCINDIBLE** |
| Viaje nuevo `/trips/new` | 387 | `trips(...)`, y `budgets` si el presupuesto > 0 | sub-página | **IMPRESCINDIBLE** |
| Detalle de viaje `/trips/[id]` | 278 | `trips.select('*')` directo a InsForge + `EditTripModal` | sub-página | **IMPRESCINDIBLE** |
| Planificación `/planning` | 817 (+1.368 de `planning/*`) | `trips(*)`, `bookings(*)`, `itinerary_activities(*)` | sí | **IMPRESCINDIBLE** |
| Gastos `/expenses` | 356 (+141 `ExpenseCard`) | `expenses(*, trip:trips(*))` | sí | **IMPRESCINDIBLE** |
| Gasto nuevo / editar | 305 + 384 | `expenses` (`amount`, `currency`, `category`, `date`, `trip_id`) | sub-páginas | **IMPRESCINDIBLE** |
| Tareas `/tasks` | 231 (+548 de `tasks/*`) | `tasks` (sin `trip_id`) | sí | **UTIL PERO SECUNDARIA** |
| Presupuesto `/budget` | 780 (+271 `BudgetCard`) | `budgets(*)`, y recalcula `spent_amount` cruzando `expenses` | sí | **REDUNDANTE CON OTRA** |
| Análisis `/analytics` | 558 (+382 `charts/*`) | `trips`, `expenses(*)`, `budgets(*)` por rango | sí | **REDUNDANTE CON OTRA** |
| Notas `/notes` | 389 (+134 +278) | `notes(*, trip:trips(*))` | sí | **UTIL PERO SECUNDARIA** |
| Nota `/notes/[id]` | 384 | `notes(*, trip:trips(*))` directo | **no** | **HUÉRFANA** |
| Alertas `/alerts` | 286 (+184 `AlertCard`) | `alerts` (solo lectura) | **no** | **HUÉRFANA** |
| Perfil `/profile` | 239 | `profiles`, storage `avatars` | menú de perfil | **IMPRESCINDIBLE** |
| Ajustes `/settings` | 104 | ninguna tabla (tema + cambio de contraseña) | menú de perfil | **UTIL PERO SECUNDARIA** |

### Superficies transversales (no son rutas)

| Superficie | Ficheros (líneas) | Datos | Etiqueta |
|---|---|---|---|
| Campana de avisos | `notifications/NotificationSystem.tsx` 515 | `alerts` (lee y marca leído) | **REDUNDANTE CON OTRA** (con `/alerts`) |
| Asistente | `chatbot/*` 370 + `/api/chat` 65 | LLM por `OPENROUTER_API_KEY` | **UTIL PERO SECUNDARIA** |
| Calendario | `calendar/Calendar.tsx` 594 | ninguno: pinta `CalendarEvent` construidos a mano | **UTIL PERO SECUNDARIA** (compartido por planning y tasks) |

### Código y datos muertos

| Qué | Evidencia | Veredicto |
|---|---|---|
| `src/lib/insforge-functions.ts` (471) | **0 importadores** en todo `src` | **se va** |
| `src/components/trips/TripCard.tsx` (121) | solo se menciona en el test de diseño; ninguna página lo importa | **se va** |
| Tablas `reminders` y `calendar_events` | solo las usaba el fichero anterior; ningún otro acceso | **se van** (con migración aparte) |
| Escritura en `alerts` | **no existe**: 8 accesos y ninguno es `insert` | deja la campana y `/alerts` sin fuente |

## Justificación de cada etiqueta

**IMPRESCINDIBLES.** Viajes (y sus dos sub-páginas) es la columna vertebral: **9 secciones distintas
leen `trips`**, y `trips/new` es además la única puerta que crea un `budgets`. Gastos es el otro
núcleo: dashboard, analítica y presupuesto derivan sus cifras de `expenses`. Planificación es hoy el
**único** sitio donde viven reservas y actividades tras el [ADR-006](../DECISIONS/ADR-006-vuelos-de-amadeus-a-entrada-manual.md)
(el vuelo pasó a ser un `bookings` de tipo `flight`), así que no es negociable sin reescribir ese
ADR. Perfil sostiene lo que se ve en la barra (nombre y avatar salen de `profiles`). Auth y landing
son la puerta y el escaparate.

**UTIL PERO SECUNDARIA.**
- **Tareas**: `tasks` **no tiene `trip_id`**, y eso la separa del viaje: es una lista de pendientes
  global, no un plan de viaje. Su único solape con planificación es de **interfaz**, no de datos:
  las dos montan un calendario (`Calendar.tsx` es exactamente el mismo componente).
- **Notas**: 773 líneas de página para un `notes` con `title, content, category, trip_id,
  is_favorite`. Funciona y es el germen del diario de viaje, que es otra tarea.
- **Ajustes**: 104 líneas, ninguna tabla. Es tema + cambio de contraseña.
- **Asistente**: presente en todas las páginas privadas; es el único proxy que conserva un secreto
  de servidor (ver la auditoría de dependencia del servidor), así que su coste no es solo de UI.
- **Calendario**: 594 líneas compartidas por dos secciones. Es un **activo**, no una sección.

**REDUNDANTES.**
- **Panel vs Análisis**: los dos leen **las mismas tres tablas** (`trips`, `expenses`, `budgets`) y
  calculan **los mismos totales** (gasto total, presupuesto, número de viajes). Análisis añade
  filtro por rango de fechas, de moneda y gráficos; el panel añade "lo próximo". Son **una sola
  pantalla con dos modos**, no dos secciones. 452 + 558 líneas (+382 de gráficas) para eso.
- **Presupuesto vs Gastos y Análisis**: los tres derivan el gasto real de `expenses` con los mismos
  campos (`amount`, `currency`, `category`, `date`, `trip_id`). Presupuesto, además, **no se fía de
  `budgets.spent_amount`** y recalcula el gasto en el cliente cruzando `expenses`. Y un presupuesto
  ya nace dentro de un viaje (`trips/new` crea el `budgets`): 780 líneas + 271 de tarjeta para una
  vista que duplica lo que ya dicen gastos y análisis.
- **Campana vs `/alerts`**: las dos leen `alerts` y las dos marcan `is_read`. La campana es el
  componente global (515 líneas) y `/alerts` es su versión de página completa (286 + 184). Ninguna
  de las dos puede mostrar nada, porque **nadie inserta en `alerts`**.

**HUÉRFANAS.**
- **`/alerts`**: no está en el array `navigation` y **nada** enlaza a ella. El grep de `/alerts` en
  todo `src` solo devuelve el `proxy` (la protege) y la lista del test de diseño. Se llega
  únicamente escribiendo la URL.
- **`/notes/[id]`**: **nada** enlaza a una nota concreta. `NoteCard` solo expone `onEdit` (línea
  89), que abre el editor en la propia lista. No hay ningún `href` ni `router.push` hacia
  `/notes/<id>` en la base. Es una página de detalle completa (384 líneas) inalcanzable.

## Lo que sobra, sin miedo

1. **`/alerts` (470 líneas con su tarjeta)**: huérfana y sin fuente de datos. Se va.
2. **`/notes/[id]` (384 líneas)**: inalcanzable. Se va (el editor en la lista ya hace el trabajo).
3. **`insforge-functions.ts` (471) + `TripCard.tsx` (121)**: código muerto, 0 importadores. Se van.
4. **`reminders` y `calendar_events`**: tablas sin ningún escritor ni lector vivo. Se van.
5. **La duplicación entre `/budget` (`count`, `spent_amount`) y `/expenses`** y **entre `/analytics`
   y `/dashboard`**: no es que sobren funcionalidades, es que están **contadas dos veces**. Es la
   mayor fuente de superficie evitable: ~1.700 líneas entre las dos parejas.
6. **El segundo calendario**: `tasks` monta vista de calendario con el mismo `Calendar.tsx` que usa
   planificación. Sobra una de las dos entradas al mismo componente.

Lo que **no** sobra: viajes, gastos, planificación, perfil, auth y landing. Y el asistente y las
notas son discutibles pero defendibles: el primero tiene coste de servidor, los segundos son
baratos y alimentan el diario de viaje.

## Propuesta de rework funcional

La app, diseñada de cero sobre el backend que ya existe (InsForge + RLS, sin tocar el esquema más
allá de borrar tablas muertas), con **cinco secciones**:

### Las cinco que se quedan

1. **Viajes**: `trips` con su detalle. Es la entidad raíz: 9 secciones leen de ella.
2. **Planificación**: `bookings` + `itinerary_activities`. Es el único hogar de reservas y
   actividades desde el ADR-006. Absorbe la agenda de tareas.
3. **Gastos**: `expenses` + el plan de `budgets` del propio viaje (previsto frente a real).
4. **Panel**: `trips` + `expenses` + `budgets` con selector de rango. Sustituye a la pareja
   panel/análisis y hereda las gráficas que ya existen.
5. **Cuenta**: auth + `profiles` + `avatars` + tema. La landing sigue siendo la puerta pública.

### Lo que se fusiona

| Fusión | Qué pasa | Líneas que dejan de duplicarse |
|---|---|---|
| **Análisis → Panel** | Un "Panel" con selector de rango y las gráficas actuales. `/analytics` desaparece como ruta. | ~558 de página (los 382 de gráficas se reutilizan) |
| **Presupuesto → Gastos** | El presupuesto pasa a ser "previsto" en la vista de gastos del viaje; la vista global de presupuesto desaparece. | ~780 + 271 |
| **Tareas → Planificación** | Una sola agenda con capas (viajes, actividades, tareas). `tasks` mantiene su tabla (no tiene `trip_id`), pero pierde su calendario propio. | ~54 de vista + una de las dos entradas |
| **Notas: `/notes/[id]` → `/notes`** | El editor en modal de la lista es el que se usa de verdad. | ~384 |
| **Alertas: `/alerts` → campana** | Si se conservan, solo la campana. Y antes hay que decidir **qué escribe en `alerts`**, o se retira entera. | ~470 |

### Lo que se va

`/alerts` y `/notes/[id]` como rutas; `insforge-functions.ts`; `trips/TripCard.tsx`; las tablas
`reminders` y `calendar_events`; el segundo calendario. Total: **~1.570 líneas de UI** y dos tablas
sin uso.

### Coste y riesgos

Coste (en unidades, no en tiempo):

- **Rutas a borrar**: 2 (`/alerts`, `/notes/[id]`), más 2 fusionadas (`/analytics`, `/budget`) y 4
  sub-páginas intactas.
- **Ficheros a borrar**: 5 de UI + 2 de librería.
- **Tests que hay que actualizar**: el guardián de diseño nombra `alerts/AlertCard.tsx` en la lista
  de botones nativos, y `proxy.test.ts` protege `/alerts` y `/notes/abc` como rutas privadas.
- **Navegación**: el array `navigation` pasa de 8 entradas a 3 o 4.
- **Backend**: solo el borrado de `reminders` y `calendar_events`, con su propia migración y su
  propia decisión (no cabe en un rework de UI).

Riesgos, por gravedad:

1. **Se pierde superficie que alguien pueda usar de verdad** (el filtro por rango de análisis, el
   presupuesto como entidad propia). El rework no debe asumir que nadie la usa: hoy no hay analítica
   de producto que lo mida. Es el riesgo número uno y es de producto, no técnico.
2. **El rework toca rutas que la app protege por `middleware`**: si se borran sin actualizar
   `protectedRoutes`, quedan prefijos protegiendo rutas inexistentes (inocuo) o, peor, se borra una
   ruta y su protección sin darse cuenta de que compartía prefijo.
3. **La duplicación de datos del ADR de servidor sigue ahí**: 13 handlers que envuelven
   `requireUser()` + SDK cuando el navegador ya llama a InsForge en **37 puntos**. Es la deuda que
   más líneas ahorra (1.283) pero **es arquitectura de datos**, así que queda fuera de esta
   propuesta y se decide aparte.
4. Regresión funcional al fusionar panel y análisis o gastos y presupuesto: son las dos pantallas
   más grandes y las más cruzadas por datos.

### Lo que no tocaría

- **InsForge, RLS, migraciones, secretos y CI**: el rework es de UI y de secciones. Lo único de
  backend que se propone (borrar dos tablas muertas) va en su propia migración y su propia decisión.
- **El esquema vivo**: `trips`, `expenses`, `notes`, `tasks`, `bookings`, `itinerary_activities`,
  `budgets`, `alerts`, `profiles`, `users` se quedan como están. No hace falta una columna nueva.
- **El modelo de sesión** (refresh httpOnly, server actions, `middleware`): la auditoría de
  dependencia del servidor ya lo midió y el veredicto fue no migrar.
- **La base de diseño que se acaba de cerrar** (tokens, componentes compartidos, armazón): el
  rework se apoya en ella en vez de volver a pintar.
- **El asistente**: decisión de producto, no de arquitectura. Si se queda, se queda como está.

## Estado

**Propuesta.** Ni una ruta se ha borrado ni fusionado en este trabajo. El inventario y las cifras
son reproducibles sobre `main`; las etiquetas y las fusiones son la recomendación que se somete a
decisión en el issue #44. La primera decisión (qué se va) es de producto y necesita firma humana
antes de que nadie implemente el rework.

> Nota posterior (ver [ADR-008](../DECISIONS/ADR-008-retirada-del-asistente.md)): el asistente
> (`chatbot/*`, `/api/chat`, `src/lib/llmService.ts`) se ha **retirado por completo**. Era la
> superficie descrita aquí como "útil pero secundaria"; su coste (endpoint de servidor y secreto de
> servidor que rotar) no se sostiene sin presupuesto para un LLM detrás.
