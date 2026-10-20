# QA del interior con sesión real — 20 de octubre de 2026

Primera verificación visual de las pantallas autenticadas **después** del port del rediseño
(PR #105, `main` `9f1abff`). Hasta ahora solo estaban cubiertas por Jest y por el `e2e` de CI;
nunca se habían mirado renderizadas con datos.

## Cómo se reproduce

- Backend: proyecto InsForge `travelpal` (el real, no un stub).
- Cuenta de pruebas: `qa.travelpal@pablorg.dev`, creada por SQL en `auth.users` con
  `email_verified = true`. Contraseña en `~/.hermes/cache/scratch/travelpal-qa/creds.txt` (600).
- Datos sembrados por SQL, todos con `user_id` de esa cuenta: 2 viajes (uno futuro, uno pasado),
  4 actividades de itinerario, 4 tareas en los tres estados, 3 gastos, 2 presupuestos (EUR y USD),
  2 notas con etiquetas y 1 entrada de diario.
- Capturas tomadas en **producción** (`https://app-viajes.prg-dev.workers.dev`) con Chromium,
  sesión iniciada por el flujo real de `/signin`, a 1440×900 y 390×844, claro y oscuro.

## Qué se capturó

| Pantalla | Ficheros | `h1` observado |
|---|---|---|
| Dashboard | `dashboard-{1440,390}-{light,dark}`, `dashboard-1440-dark` | «Bienvenido, QA» |
| Viajes | `trips-{1440,390}-light` | «Tus viajes» |
| Detalle de viaje | `trip-1440-light` | «Lisboa, a tu ritmo» |
| Planificación | `planning-{1440,390}-light` | «Planificación» |
| Tareas | `tasks-{1440,390}-light` | «Lo importante, antes de salir.» |
| Gastos | `expenses-{1440,390}-light`, `expenses-1440-dark` | «Gastos y presupuestos» |
| Notas | `notes-1440-light` | «Tu cuaderno de viaje.» |
| Perfil | `profile-1440-light` | «Tu perfil» |
| Ajustes | `settings-1440-light` | «Ajustes» |
| Alta de viaje | `create-trip-1440-light` | «Dale forma a tu próximo viaje.» |

17 capturas en total, en esta misma carpeta.

## Resultados

- **Sin desbordamiento horizontal** en ninguna de las 17 capturas
  (`document.documentElement.scrollWidth === window.innerWidth` en todas, incluida la móvil de 390).
- La copia editorial del rediseño está viva en producción: los titulares no son los antiguos
  («Planificación», «Gastos») sino los del diseño («Lo importante, antes de salir.»,
  «Tu cuaderno de viaje.», «Dale forma a tu próximo viaje.»). Esto descarta que el port se
  quedara a medias en el interior.
- El dashboard compone bien con datos reales: antetítulo, titular del viaje, fila de metadatos
  con ruta y fechas, «Faltan 8 días», CTA, y las tres secciones («Los primeros planes»,
  «Antes de salir», «Presupuesto del viaje») sin solapes ni cortes de texto.
- El presupuesto se pinta como `341,40 € de 900,00 € — 38 %` cuando las categorías cuadran.

## Hallazgo

**`budgets.spent_amount` no se usa en el dashboard.** `NextTrip.tsx:43` (`getBudgetSpent`)
recalcula el gasto sumando `expenses` que coincidan en **fecha dentro del rango, categoría,
viaje y divisa**; la columna `spent_amount` de la tabla se ignora. Consecuencia: un presupuesto
cuya `category` no coincida con las de sus gastos muestra **0 %** aunque la base tenga un importe
gastado (me pasó al sembrar: presupuesto `general` con gastos `transporte`/`alojamiento`/`comida`
→ 0,00 €). No es un crash, pero es una fuente de verdad duplicada: o se mantiene la columna al
día, o se quita y se documenta que el gasto se deriva. Merece issue propio.

## Lo que sigue sin cubrir

- No se han probado **interacciones** (alta de viaje real, drag & drop de tareas, subida de foto
  de diario) ni los estados de error de red con el backend caído.
- El perfil y los ajustes se ven escasos con esta cuenta (282 y 595 caracteres de texto):
  el formulario de perfil está prácticamente vacío y no se ha validado el guardado.
- La cuenta de QA tiene la misma contraseña que la cuenta del propietario (se copió el hash para
  poder entrar sin manejar secretos). Antes de compartirla, hay que cambiarla.
