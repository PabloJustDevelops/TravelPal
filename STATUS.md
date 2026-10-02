# STATUS.md — TravelPal

## Dónde estamos

`main` está en `217d007` y el árbol de trabajo está limpio. El **doble camino de datos está
cerrado**: el BFF se retiró y todos los datos de usuario van por el SDK de InsForge en el navegador
con RLS (`auth.uid()`); en el servidor solo sobrevive `/api/auth/refresh` (ADR-009, ADR-012). La
dirección visual **«Cuaderno de viaje»** está implantada en la capa de fundamentos, por tokens y
alias de escalas (ADR-007). El **push de navegador tiene hecha la parte de cliente**; el envío real
sigue bloqueado (ADR-013). Los últimos commits en `main` son la reescritura de las policies RLS con
subquery, los índices de las FKs de `alerts`/`budgets` (#65) y la subida de
`next`/`@opennextjs/cloudflare`/`tailwind` por seguridad (#88).

## Ahora mismo

- **#85 (needs-triage)**: la migración `middleware → proxy` (#78) subió el tamaño del Worker
  **+37 % sin comprimir / +46 % gzip**. Ya está **medido y localizado** (2026-10-03): el delta es el
  bundle del proxy, que en runtime `nodejs` pasa de 0,54 a 3,30 MiB (`handler.mjs`). No se revierte
  (`middleware` está deprecado en Next 16) y 4,1 MiB gzip está muy por debajo del límite de 10 MiB de
  Workers. Queda la decisión de cierre por el propietario.
- **Push de navegador (#48)**: la parte de cliente está entregada y probada; queda decidir cuándo se
  desbloquea el envío de servidor.
- **Esquema**: `20260918210000_drop-public-users.sql` **aplicada** el 2026-10-02 con aprobación humana
  (backup previo `antes-de-drop-users`); `public.users` ya no existe y sus 3 policies RLS se fueron con
  ella. `20261002210811_add-fk-indexes-alerts-budgets.sql` y
  `20261002220747_rewrite-rls-policies-with-subquery.sql` también aplicadas: el advisor está en
  **0 warnings** y el aislamiento por propietario se probó cruzando dos usuarios reales.

## Los siguientes 3 pasos

1. **Cerrar #38 y #36**: las etapas 0-5 de #38 están hechas (solo sobreviven `/api/auth/refresh` y el
   callback de OAuth, que no pueden bajar al cliente) y el veredicto de #36 es NO-GO ya registrado en
   `docs/audits/auditoria-spa-vs-next.md`. Ambos issues siguen abiertos sin motivo.
2. **Desbloquear el envío de push (#48)** cuando haya presupuesto y métrica de uso: migración + edge
   function + schedule en una sola etapa, con el esquema ya redactado en ADR-013.
3. **Limpiar el backend**: 48 usuarios `e2e-*` sin verificar y 59 OTPs caducados en `auth`. InsForge no
   expone endpoint para borrarlos; hay que hacerlo desde el dashboard.

## Bloqueos

| Bloqueo | Qué falta | Referencia |
|---|---|---|
| Envío real de push (Web Push) | Tabla `push_subscriptions`, marca de envío (`sent_at`), edge function `send-push` + schedule y secretos VAPID | ADR-013 / #48 |
| Búsqueda de vuelos en vivo | Proveedor viable: Amadeus retiró su portal self-service; el vuelo se registra a mano | ADR-006 |
| Inspiración de precios (Travelpayouts) | Cuenta y token del propietario | #41 (`ready-for-human`) |
| Cierre de #38 y #36 | Decisión del propietario: el trabajo ya está hecho y documentado | ADR-009, ADR-012 |

## Última actualización

2026-10-03 — `main` @ `217d007`.
