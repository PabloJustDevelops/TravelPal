# ADR-013: Notificaciones push de navegador: el cliente ya, el envio bloqueado

## Contexto

El issue [#48] especifica notificaciones push de navegador (Web Push) para las alertas que la
campana **ya** deriva y persiste en `alerts` (tareas que vencen, reservas proximas y presupuestos
superados, ver `src/lib/alerts.ts` y `NotificationSystem.tsx`). Hoy esa fuente solo se ve con la app
abierta: no hay aviso para quien no esta mirando, que es justo el valor de una app de viajes.

La spec de [#48] no se ejecuta entera por una decision de coste (un envio de servidor exige una
edge function, un schedule, dos secretos y un modo de fallo nuevo), no por arquitectura. A eso se
suma una **restriccion de este carril**: el backend de InsForge no se toca. Web Push necesita
guardar suscripciones por usuario, y eso seria una tabla nueva (`push_subscriptions`): no se crea.

Lo que el navegador ofrece para la parte de cliente esta verificado antes de escribir esto:

- `navigator.serviceWorker.register(scriptURL, { scope, updateViaCache })` devuelve una
  `Promise<ServiceWorkerRegistration>`; `registration.pushManager` es el `PushManager` de ese
  registro.
- `pushManager.getSubscription()` devuelve `Promise<PushSubscription | null>`;
  `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` devuelve
  `Promise<PushSubscription>`. `userVisibleOnly` tiene que ser `true` o Chrome/Edge **rechazan** la
  promesa.
- `PushSubscription.toJSON()` es el serializador estandar (lo llama `JSON.stringify`): devuelve
  `endpoint`, `keys.p256dh`, `keys.auth` y `expirationTime`. Esa es la forma que la futura tabla
  guardara. `unsubscribe()` devuelve `Promise<boolean>`.
- `Notification.permission` es `"granted" | "denied" | "default"`; `requestPermission()` devuelve
  una promesa con ese mismo string. El navegador solo deja preguntar una vez por origen.
- En el service worker, `push` recibe `event.data` (con `json()`/`text()`) y `notificationclick`
  expone `event.notification` (`close()`, `data`) y `clients.matchAll({ type: "window" })` para
  enfocar una pestana o `clients.openWindow(url)` para abrir una.

Fuentes: guia PWA de Next 16 (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`)
y las paginas de MDN de `PushManager.subscribe`, `PushManager.getSubscription`, `PushSubscription`,
`PushSubscription.toJSON`, `PushSubscription.unsubscribe`, `Notification.permission`,
`Notification.requestPermission` y `notificationclick`.

## Decision

1. **Se implementa la parte de cliente que no necesita backend.** `public/sw.js` escucha `push` y
   `notificationclick`, muestra la notificacion y, al pulsarla, enfoca o abre la url del aviso
   (`/trips/<id>` o `/dashboard`). No introduce ruta nueva ni toca `middleware.ts`; el registro se
   hace desde `src/lib/push.ts` con scope `/` y `updateViaCache: "none"`.
2. **El permiso solo se pide con un gesto explicito.** Se **retira** el `Notification.requestPermission()`
   que `NotificationSystem` lanzaba al montar (quemaba el permiso sin contexto; el riesgo 1 de [#48]).
   El alta y la baja viven en la tarjeta «Notificaciones» de `/settings`, via `usePushNotifications`.
   Si el usuario ya dijo no, la interfaz lo explica y **no** vuelve a preguntar.
3. **La suscripcion se guarda en localStorage como puente, no como fuente de verdad.**
   `subscribeToPush` serializa la `PushSubscription` y la refleja en
   `travelpal.push.subscription.v1`. El estado real lo dicta `pushManager.getSubscription()`: al
   montar, el hook reconcilia y descarta el puente si no hay suscripcion viva. El puente existe solo
   para que la interfaz y el contrato de datos existan y se prueben mientras el backend esta
   bloqueado.
4. **Clave publica VAPID opcional.** El cliente lee `NEXT_PUBLIC_VAPID_PUBLIC_KEY` con un acceso
   estatico (ver [ADR-005]). Si falta, la tarjeta queda desactivada y el alta falla con un error
   claro; no se inventa una clave. La clave privada (`VAPID_PRIVATE_KEY`) y el asunto
   (`VAPID_SUBJECT`) son secretos de servidor y no aparecen en el repo.
5. **Sin dependencia nueva en el cliente.** Solo APIs del navegador y React ya presentes.

### Lo que queda bloqueado (y por que)

El push **no se entrega de verdad** hasta que exista backend. Bloqueado, no hecho:

- **Tabla `push_subscriptions`** con RLS de propietario y `grant`: seria una tabla nueva y el
  backend no se toca en este carril.
- **Marca de envio** (una columna `sent_at` en `alerts` o una tabla de envios) para no reenviar: sin
  ella, un schedule reintentaria y el usuario recibiria el mismo aviso varias veces (riesgo 3).
- **Edge function `send-push` + schedule**: consulta las alertas pendientes, firma con VAPID y hace
  el POST a cada `endpoint`, borrando las suscripciones que respondan 404/410. No puede vivir en el
  Worker de Next: el envio exige criptografia de Web Push.
- **Secretos VAPID** como secretos del backend y su rotacion.

### Esquema propuesto (NO aplicado)

Se deja escrito para que la etapa que lo desbloquee sea solo ejecutarlo, con el mismo estilo
idempotente que `journal_photos` ([ADR-011](ADR-011-fotos-del-diario-privadas.md)):

```sql
-- NO creada a proposito: el backend esta fuera de este carril. Ver ADR-013.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  using (auth.uid() = user_id);
create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);
create policy push_subscriptions_update_own
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to anon, authenticated;

-- Estado de envio para no repetir el aviso (alternativa a una tabla de envios).
alter table public.alerts add column if not exists sent_at timestamptz;
```

## Consecuencias

- **Ya funciona y esta probado**: el service worker (registro y disparo de los dos eventos), el flujo
  de permiso (concedido, denegado, ya suscrito), el alta y la baja, y el puente en localStorage. Todo
  con pruebas de jest que no tocan red ni backend.
- **Todavia no llega ningun aviso**: sin tabla, funcion, schedule ni secretos, el `endpoint` que se
  guarda no tiene a nadie que le envie. Es un andamio con contrato, no una funcion entregada.
- **El puente puede mentir si se trata como fuente de verdad**: por eso el hook reconcilia contra
  `getSubscription()` y limpia el puente si la suscripcion ya no vive. La interfaz nunca se fia solo
  de localStorage.
- **iOS no es paridad 1:1**: en Safari el push exige la app instalada como PWA (no basta la pestana).
  La interfaz lo dice en el texto de soporte; no se promete «funciona en el movil» a secas.
- **La entrega real no la cubre jest**: hay que probarla en un dispositivo real (Android y iOS). Es la
  prueba manual que la spec de [#48] aparta a proposito.

## Alternativas consideradas

- **Ir directo a la tabla con una migracion.** Descartada en este carril: el backend no se toca, y una
  tabla sola no entrega nada (haría falta, a la vez, la funcion de firma, el schedule y los secretos).
  Cuando se desbloquee, es la via correcta y el esquema de arriba es el punto de partida.
- **No hacer nada de cliente y entregar solo este ADR.** Descartada: el service worker, el permiso
  explicito y el alta/baja son verificables hoy, y ademas corrigen un fallo real (el permiso se pedia
  al cargar). Dejar solo el documento renuncia a esa parte sin ganar nada.
- **Guardar la suscripcion solo en memoria.** Descartada: no sobrevive a una recarga ni permite
  inspeccionar el contrato de datos que la tabla necesitara.
- **Pedir el permiso en la campana al vuelo.** Descartada como unica via: el permiso debe pedirse con
  contexto y desde un gesto; la campana queda como superficie de lectura, no de permiso.

## Supuestos

- La clave publica VAPID se generara y se pondra en `.env.local` y en los secretos del deploy; este
  ADR no genera claves.
- El payload del push sera JSON `{ title, body, url }`; el service worker cae a `TravelPal` +
  `/dashboard` ante cualquier payload ausente o ilegible. Es una decision de interfaz, no una API
  verificada del backend (aun no existe el emisor).
- La ventana y las reglas de que genera alertas no se tocan: este trabajo **consume** las alertas.

## Estado

Aprobado en su parte de cliente. El envio (tabla, funcion, schedule y secretos) queda bloqueado hasta
que haya metrica de uso de la campana y presupuesto para un envio de servidor, como pide [#48].

[#48]: https://github.com/PabloJustDevelops/TravelPal/issues/48
[ADR-005]: ADR-005-web-no-carga-env-no-inlineado.md
