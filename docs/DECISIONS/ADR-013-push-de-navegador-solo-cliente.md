# ADR-013: Push de navegador con envío en InsForge

## Contexto

El issue [#48] pide entregar fuera de la app las alertas de tareas, reservas y presupuestos que
la campana persiste en `alerts`. Next.js es un export estático servido por Cloudflare Workers Assets;
el servidor de envío debe vivir en InsForge. La etapa inicial construyó el service worker, permiso
explícito, serialización y puente de localStorage sin backend. El encargo de servidor de 2026-10-23
levanta aquella restricción y añade la migración y función, sin activar infraestructura remota.

## Decisión

- Conservar el cliente de navegador y el gesto explícito de Ajustes. Nunca pedir permiso al montar.
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` entra al build desde el entorno y la variable de GitHub Actions.
  La privada JWK, el subject y el secreto de servicio solo viven en InsForge.
- Añadir `push_subscriptions` con endpoint único, FK a `auth.users`, RLS CRUD de propietario,
  `last_seen_at` y privilegios explícitos para `authenticated` y `project_admin`, sin acceso anónimo.
- Usar **`alerts.push_sent_at` en lugar de una tabla de entregas**: la unidad de confirmación es la
  alerta del usuario. Se confirma si al menos un servicio acepta el aviso. Es suficiente para evitar
  repetir ciclos completados y mantiene un único estado por alerta. Una tabla por dispositivo se
  justifica cuando se necesiten reintentos individuales, historial o transición de múltiples claves;
  hoy complicaría el contrato sin un requisito de entrega a todos los dispositivos.
- Añadir una reserva temporal (`push_claimed_at`, `push_claim_token`) independiente de la marca de
  envío. El RPC administrativo reserva con `FOR UPDATE SKIP LOCKED`, caduca a los 5 minutos y no
  eleva a usuarios (`SECURITY INVOKER`). Evita seleccionar simultáneamente la misma alerta. En
  fallos, conserva la fecha del último intento y limpia solo el token; claims nunca intentados van
  primero, y los reintentos rotan por antigüedad de intento sin perderse.
- `send-push` acepta exclusivamente POST con `X-Push-Secret`, nunca bearer de usuario. Consume hasta
  10 alertas no leídas vencidas en las últimas 24 horas, con suscripciones y `push_sent_at is null`.
  No deriva nuevas alertas. Cada alerta usa hasta las 20 suscripciones vistas más recientemente.
- Implementar VAPID ES256 y RFC 8291 `aes128gcm` con WebCrypto de Deno, sin nuevas dependencias npm.
  Clave efímera de cifrado distinta de VAPID, timeout por envío, destinos HTTPS permitidos y sin
  redirecciones. El payload sigue siendo `{ title, body, url }` para el service worker existente.
- Borrar suscripciones en 404/410. Otros errores dejan pendiente la alerta si nadie aceptó el aviso.
  Una aceptación parcial confirma la alerta globalmente, sin reintentos por dispositivo.
- Programar cada 15 minutos mediante InsForge, una vez configurados secretos y publicada la función.
  Comandos, límites operativos, pruebas y rotación: [docs/PUSH.md](../PUSH.md).

## Consecuencias

La migración es idempotente y nueva; no modifica SQL aplicado. Los tests de Deno comprueban firma y
cifrado y los de PGlite comprueban políticas y reservas. Los tests no equivalen a entrega real:
la aceptación del proveedor no demuestra que el navegador mostrara el aviso.

La marca no garantiza exactamente una entrega: una caída entre aceptación HTTP y confirmación DB
puede repetir tras caducar la reserva. Las alertas de más de 24 horas se descartan de la selección
para evitar una avalancha de avisos antiguos. Una tabla por entrega queda como evolución si cambia
el requisito. Un dispositivo fuera de los 20 más recientes no recibe el aviso de esa alerta.

La campana sigue siendo quien genera alertas al abrir la app. Si hace falta generarlas mientras
nadie visita la app, será otro trabajo. Safari iOS requiere instalación como PWA.

## Estado

Implementado en código **con envío de servidor**, pendiente de activación y validación real.
No se han aplicado la migración ni los secretos, el deploy ni el schedule en el backend.

**Persistencia cliente implementada:** `src/lib/push.ts` usa upsert por endpoint y la identidad
verificada del SDK; la baja borra la fila propia. `usePushNotifications` reconcilia al hidratar
la sesión y cambiar de cuenta, también desde el layout global. Ajustes permite el alta cuando
hay clave pública y soporte. Los errores del SDK se muestran sin falsear el estado del navegador.
La activación de infraestructura y la prueba real de entrega siguen pendientes.

[#48]: https://github.com/PabloJustDevelops/TravelPal/issues/48
