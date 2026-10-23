# Push de navegador: servidor (#48)

## Arquitectura y límites

Next.js sigue siendo un export estático. `send-push` es una función Deno de InsForge,
invocada por un schedule, sin route handlers. Usa únicamente WebCrypto para VAPID ES256
([RFC 8292](https://www.rfc-editor.org/rfc/rfc8292.html)) y cifrado ECDH/HKDF/AES-GCM
`aes128gcm` ([RFC 8291](https://www.rfc-editor.org/rfc/rfc8291.html)). El SDK de InsForge
se fija a `npm:@insforge/sdk@1.5.2`, la versión del lockfile; no hay dependencias nuevas.

**Esta entrega es la mitad de servidor, todavía no activada en producción.** El cliente actual
solo guarda la suscripción en localStorage y Ajustes mantiene deshabilitada el alta. Falta conectar
el alta/baja/reconciliación con `push_subscriptions` usando la sesión del propietario, además de
aplicar la migración, configurar secretos, publicar la función y programarla. No habilitar Ajustes
hasta terminar esa integración. No se ha probado una entrega real a un navegador.

La campana crea las filas `alerts` desde tareas, reservas y presupuestos cuando se abre la app.
El servidor consume esas filas: no crea alertas si la campana no se ha ejecutado.

- Migración: `migrations/20261023120000_browser-push-server.sql`, idempotente. RLS CRUD con
  `(select auth.uid()) = user_id`; sin acceso anónimo. `endpoint` único; claves `p256dh` y `auth`
  en base64url sin padding; `last_seen_at` debe actualizarlo el futuro cliente al reconciliar.
- Autorización exclusiva mediante `X-Push-Secret`. Un bearer de usuario no autoriza el envío.
  No hay CORS: el navegador no invoca esta función. No se lee el cuerpo ni se aceptan parámetros.
- RPC `claim_push_alerts` solo ejecutable por `project_admin` (API key administrativa de InsForge).
  Reserva atómicamente hasta 10 alertas no leídas, sin envío previo y con suscripciones. Fecha efectiva:
  `coalesce(alert_date, created_at)`, entre ahora menos 24 horas y ahora. No anticipa alertas futuras.
- `push_claimed_at` + `push_claim_token` y `FOR UPDATE SKIP LOCKED` evitan trabajo solapado;
  la reserva caduca a los 5 minutos tras una caída. La finalización exige el mismo token. Si un
  envío falla, conserva `push_claimed_at` y limpia el token; tras caducar el lease puede reintentarse.
  Los claims nulos van primero y luego se ordena por último intento, fecha efectiva e ID, para que
  los fallos repetidos roten detrás de alertas aún no intentadas.
- Cada alerta intenta hasta las 20 suscripciones más recientes del usuario, en paralelo; las alertas
  se procesan en serie. Es un límite operativo deliberado: usuarios con más de 20 dispositivos
  solo reciben el aviso en los 20 más recientes. Timeout HTTP/DB de 5 segundos; sin reintento interno.
- Solo endpoints HTTPS de FCM (`fcm.googleapis.com`), Apple (`web.push.apple.com`) y Mozilla
  (`updates.push.services.mozilla.com` y un subdominio de `push.services.mozilla.com`). Sin
  credenciales, puertos alternativos ni redirecciones. Es una defensa SSRF y una lista de producto,
  no una lista universal de Web Push: otro proveedor exige revisar y ampliar la función.
- Payload `{ title, body, url }`, título hasta 100 caracteres y cuerpo hasta 500; TTL 900 segundos.
  `url` apunta a `/trip?id=<id>` (ruta real del export) o a `/dashboard`. Las respuestas HTTP nunca incluyen contenido ni endpoints.
- `404/410` elimina la suscripción. Otros errores conservan la alerta sin marca para reintentar en
  el siguiente ciclo elegible (después de 5 minutos). Si no hay ninguna aceptación 2xx,
  `push_sent_at` sigue siendo `null`.
- Si algún servicio acepta el aviso, se marca la alerta como enviada globalmente. No hay reintento
  por dispositivo tras éxito parcial. Un 2xx significa aceptación del servicio push, no que el
  usuario haya visto la notificación. Los contadores `{ sent, deleted, failed }` cuentan intentos
  por suscripción y solo se devuelven tras persistir el resultado. Un fallo de DB devuelve 503.

La garantía es **al menos una vez ante caídas**: una caída entre el POST aceptado y la escritura de
`push_sent_at` puede repetir el aviso tras caducar la reserva. No existe transacción distribuida con
el servicio push. La marca evita repetir ciclos ya confirmados; no promete entrega exactamente una vez.

## Preparación y comandos pendientes (NO ejecutados)

Usar el proyecto ya vinculado `travelpal`; no crear otro. Estos comandos modifican el backend y
quedan para el operador. Aplicar primero la migración con el flujo de migraciones del repositorio.

Generar un par P-256 fuera del repo. `VAPID_PRIVATE_KEY` debe ser un **JWK privado JSON de una línea**
con `kty: EC`, `crv: P-256`, `x`, `y`, `d`; no PEM ni el escalar privado solo. La clave pública
para el cliente es el punto sin comprimir de 65 bytes (0x04 + x + y), codificado base64url sin padding.
Guardar la privada en un gestor de secretos. No pegarla en documentos, logs ni `.env.example`.

Las siguientes variables de shell se rellenan desde ese gestor; no son valores literales.
`VAPID_SUBJECT` es un contacto `mailto:` o HTTPS controlado por el operador. El secreto de servicio
se genera con al menos 32 bytes aleatorios. Evitar historial y trazas de shell al introducirlos.

```bash
npx -y @insforge/cli db migrations up 20261023120000_browser-push-server.sql
npx -y @insforge/cli secrets add VAPID_PRIVATE_KEY "$VAPID_PRIVATE_KEY"
npx -y @insforge/cli secrets add VAPID_SUBJECT "$VAPID_SUBJECT"
npx -y @insforge/cli secrets add PUSH_SEND_SECRET "$PUSH_SEND_SECRET"
npx -y @insforge/cli functions deploy send-push --file insforge/functions/send-push/index.ts
npx -y @insforge/cli schedules create \
  --name 'TravelPal send-push' \
  --cron '*/15 * * * *' \
  --url 'https://sjdq7zsn.eu-central.insforge.app/functions/send-push' \
  --method POST \
  --headers '{"X-Push-Secret":"${{secrets.PUSH_SEND_SECRET}}"}'
```

La función usa los secretos reservados de runtime `INSFORGE_BASE_URL` y `API_KEY` vía
`createAdminClient`; no `INSFORGE_API_KEY`. No crear ni copiar una API key al frontend.
El [rol administrativo](https://github.com/InsForge/insforge-skills/blob/main/skills/insforge-cli/references/database/access-control.md)
es `project_admin`, no `service_role`. El RPC es `SECURITY INVOKER`, sin elevar permisos de usuario.

Añadir la pública como variable de GitHub Actions `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, y en `.env.local`
para build local. `.github/workflows/ci.yml` la pasa al build mediante `vars`, nunca la privada.
El bundle estático incorpora la pública al compilar: cambiarla requiere reconstruir el frontend.

Consultar la función y el schedule después de configurarlos (guardar el ID devuelto):

```bash
npx -y @insforge/cli functions list
npx -y @insforge/cli schedules get "$PUSH_SCHEDULE_ID"
npx -y @insforge/cli schedules logs "$PUSH_SCHEDULE_ID" --limit 20
```

Referencias de operación: [deploy de funciones](https://github.com/InsForge/insforge-skills/blob/main/skills/insforge-cli/references/functions-deploy.md),
[schedules](https://github.com/InsForge/insforge-skills/blob/main/skills/insforge-cli/references/schedules.md),
[secrets de runtime](https://github.com/InsForge/InsForge/blob/main/docs/core-concepts/functions/overview.mdx).
Los placeholders `${{secrets.KEY}}` del schedule se resuelven al crearlo/actualizarlo: no asumir
que rotar un secreto cambia por sí solo las cabeceras de un schedule existente.

## Rotación

1. Pausar el schedule; actualizar `PUSH_SEND_SECRET` en InsForge y volver a guardar las cabeceras
   del schedule para resolver el nuevo valor. Reanudar y comprobar logs.
2. Para rotar VAPID, generar otro par y actualizar privada/subject y pública del build coordinadamente.
   Las suscripciones están vinculadas a la pública anterior: el cliente debe cancelar y volver a
   suscribir, y sustituir las filas correspondientes. Planificar la interrupción; esta función solo
   admite una clave VAPID activa, no hay transición simultánea de dos claves.
3. Probar con un dispositivo de prueba antes de reactivar el schedule general.

```bash
npx -y @insforge/cli schedules update "$PUSH_SCHEDULE_ID" --active false
npx -y @insforge/cli secrets update PUSH_SEND_SECRET --value "$PUSH_SEND_SECRET"
npx -y @insforge/cli schedules update "$PUSH_SCHEDULE_ID" \
  --headers '{"X-Push-Secret":"${{secrets.PUSH_SEND_SECRET}}"}'
npx -y @insforge/cli secrets update VAPID_PRIVATE_KEY --value "$VAPID_PRIVATE_KEY"
npx -y @insforge/cli secrets update VAPID_SUBJECT --value "$VAPID_SUBJECT"
npx -y @insforge/cli schedules update "$PUSH_SCHEDULE_ID" --active true
```

## Pruebas

Sin secretos y sin red real durante los tests nuevos (Deno puede descargar imports inicialmente):

```bash
deno test --no-lock insforge/functions/send-push/index_test.ts
pnpm run test:push-rls
pnpm run type-check
pnpm run lint
pnpm run test:ci --runInBand
pnpm run build
pnpm run validate:static-export
```

Deno verifica la firma con la pública VAPID y descifra el body con la privada del receptor;
comprueba rechazo de bearer sin secreto, SSRF, 404/410, errores, éxito parcial y límite de lote.
PGlite aplica dos veces la migración y comprueba RLS CRUD, privilegios del RPC, ventana temporal,
reservas y deduplicación. No accede al backend del proyecto.

Prueba real pendiente, con la integración cliente y configuración terminadas: suscribir un navegador
con la pública correspondiente, confirmar su fila propia y una alerta no leída vencida hace menos de
24 horas, cerrar la app y ejecutar un ciclo. Confirmar recepción y apertura del viaje/dashboard,
`push_sent_at` persistido y ausencia de segundo envío al repetir el ciclo. Repetir con Android y con
Safari iOS instalado como PWA. Revocar una suscripción y comprobar su limpieza tras 404/410;
provocar un fallo de proveedor y comprobar que la alerta conserva `push_sent_at = null`.
