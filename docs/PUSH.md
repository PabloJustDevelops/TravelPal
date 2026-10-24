# Browser push: server delivery (#48)

## Architecture and limits

Next.js remains a static export. `send-push` is an InsForge Deno function invoked by a
schedule, with no route handlers. It uses WebCrypto only, for VAPID ES256
([RFC 8292](https://www.rfc-editor.org/rfc/rfc8292.html)) and for ECDH/HKDF/AES-GCM
`aes128gcm` encryption ([RFC 8291](https://www.rfc-editor.org/rfc/rfc8291.html)). The
InsForge SDK is pinned to `npm:@insforge/sdk@1.5.2`, the lockfile version; no new
dependencies.

Client and server are implemented in code; remote activation is still pending. The
client upserts into `push_subscriptions` on subscribe and reconciles a live
subscription when the session hydrates or the account changes, from
`PushSubscriptionSync` in the root layout and from Settings. The identity of every
write and delete comes from `auth.getCurrentUser()`, never from interface data. The
endpoint is the conflict key and every upsert refreshes `last_seen_at`. Unsubscribe
deletes the caller's row by endpoint before cancelling the browser subscription; it
does not require the row to exist. localStorage is an auxiliary cache used to
recover the endpoint at unsubscribe time.

If RLS rejects reusing another account's endpoint, the client cancels the previous
subscription and creates a new one for the current session. It never reassigns or
deletes rows it does not own; the server removes the invalidated endpoint when it
answers 404/410. Mutations are serialized so global reconciliation and Settings do
not overwrite each other. Permission is never requested automatically.

The toggle reflects the browser state even when the SDK fails, shows the error and
allows retrying. Settings enables sign-up when the browser supports push, permission
is available and the VAPID public key exists. Still pending: applying the migration,
configuring secrets, deploying the function and scheduling it. No real delivery to a
browser has been tested.

The bell creates `alerts` rows from tasks, bookings and budgets when the app is
opened. The server consumes those rows: it does not create alerts if the bell has not
run.

- Migration: `migrations/20261023120000_browser-push-server.sql`, idempotent. RLS CRUD
  with `(select auth.uid()) = user_id`; no anonymous access. `endpoint` is unique;
  `p256dh` and `auth` keys in base64url without padding; `last_seen_at` is updated
  from the client during reconciliation.
- Authorization is exclusively through `X-Push-Secret`. A user bearer does not
  authorize sending. There is no CORS: the browser does not call this function. The
  body is not read and no parameters are accepted.
- RPC `claim_push_alerts`, executable only by `project_admin` (InsForge admin API
  key). It atomically reserves up to 10 unread alerts with no previous send and with
  subscriptions. Effective date: `coalesce(alert_date, created_at)`, between now minus
  24 hours and now. Future alerts are never pulled forward.
- `push_claimed_at` plus `push_claim_token` plus `FOR UPDATE SKIP LOCKED` prevent
  overlapping work; the reservation expires 5 minutes after a crash. Completion
  requires the same token. If a send fails, `push_claimed_at` is kept and the token is
  cleared; once the lease expires the alert can be retried. Null claims go first, then
  order is by last attempt, effective date and ID, so repeated failures rotate behind
  never-attempted alerts.
- Each alert tries up to the 20 most recent subscriptions of the user, in parallel;
  alerts are processed serially. This is a deliberate operational limit: users with
  more than 20 devices only get the notice on the 20 most recent ones. HTTP/DB timeout
  of 5 seconds, no internal retry.
- HTTPS endpoints only, for FCM (`fcm.googleapis.com`), Apple (`web.push.apple.com`)
  and Mozilla (`updates.push.services.mozilla.com` and one subdomain of
  `push.services.mozilla.com`). No credentials, alternate ports or redirects. This is
  an SSRF defense and a product allowlist, not a universal Web Push list: another
  provider requires reviewing and extending the function.
- Payload `{ title, body, url }`, title up to 100 characters and body up to 500; TTL
  900 seconds. `url` points to `/trip?id=<id>` (the real export route) or to
  `/dashboard`. HTTP responses never include content or endpoints.
- `404/410` deletes the subscription. Other errors keep the alert unmarked so it is
  retried in the next eligible cycle (after 5 minutes). If no service returns 2xx,
  `push_sent_at` stays `null`.
- If any service accepts the notice, the alert is marked as sent globally. There is no
  per-device retry after partial success. A 2xx means acceptance by the push service,
  not that the user saw the notification. The `{ sent, deleted, failed }` counters
  count attempts per subscription and are returned only after the result is persisted.
  A DB failure returns 503.

The guarantee is at-least-once across crashes: a crash between the accepted POST and
the `push_sent_at` write can repeat the notice once the reservation expires. There is
no distributed transaction with the push service. The mark prevents repeating
confirmed cycles; it does not promise exactly-once delivery.

## Preparation and pending commands (not executed)

Use the already linked `travelpal` project; do not create another one. These commands
modify the backend and are left to the operator. Apply the migration first with the
repository migration flow.

Generate a P-256 key pair outside the repo. `VAPID_PRIVATE_KEY` must be a one-line
JSON private JWK with `kty: EC`, `crv: P-256`, `x`, `y`, `d`; not PEM and not the
bare private scalar. The client public key is the uncompressed 65-byte point
(0x04 + x + y), encoded base64url without padding. Store the private key in a secret
manager. Do not paste it into documents, logs or `.env.example`.

The shell variables below are filled from that manager; they are not literal values.
`VAPID_SUBJECT` is a `mailto:` contact or an HTTPS URL controlled by the operator. The
service secret is generated with at least 32 random bytes. Avoid shell history and
traces when entering them.

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

The function uses the reserved runtime secrets `INSFORGE_BASE_URL` and `API_KEY` via
`createAdminClient`, not `INSFORGE_API_KEY`. Do not create or copy an API key into the
frontend. The
[administrative role](https://github.com/InsForge/insforge-skills/blob/main/skills/insforge-cli/references/database/access-control.md)
is `project_admin`, not `service_role`. The RPC is `SECURITY INVOKER` and does not
elevate user privileges.

Add the public key as the GitHub Actions variable `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and
to `.env.local` for local builds. `.github/workflows/ci.yml` passes it to the build
through `vars`, never the private key. The static bundle embeds the public key at
compile time: changing it requires rebuilding the frontend.

Inspect the function and the schedule after configuring them (keep the returned ID):

```bash
npx -y @insforge/cli functions list
npx -y @insforge/cli schedules get "$PUSH_SCHEDULE_ID"
npx -y @insforge/cli schedules logs "$PUSH_SCHEDULE_ID" --limit 20
```

Operational references:
[function deploy](https://github.com/InsForge/insforge-skills/blob/main/skills/insforge-cli/references/functions-deploy.md),
[schedules](https://github.com/InsForge/insforge-skills/blob/main/skills/insforge-cli/references/schedules.md),
[runtime secrets](https://github.com/InsForge/InsForge/blob/main/docs/core-concepts/functions/overview.mdx).
The `${{secrets.KEY}}` placeholders in a schedule are resolved when it is created or
updated: do not assume that rotating a secret changes the headers of an existing
schedule by itself.

## Rotation

1. Pause the schedule; update `PUSH_SEND_SECRET` in InsForge and save the schedule
   headers again to resolve the new value. Resume and check the logs.
2. To rotate VAPID, generate another pair and update the private key, the subject and
   the public key in the build in a coordinated way. Subscriptions are bound to the
   previous public key: the client must cancel and subscribe again, and replace the
   corresponding rows. Plan the interruption; this function supports only one active
   VAPID key, with no simultaneous transition between two keys.
3. Test with a test device before re-enabling the general schedule.

```bash
npx -y @insforge/cli schedules update "$PUSH_SCHEDULE_ID" --active false
npx -y @insforge/cli secrets update PUSH_SEND_SECRET --value "$PUSH_SEND_SECRET"
npx -y @insforge/cli schedules update "$PUSH_SCHEDULE_ID" \
  --headers '{"X-Push-Secret":"${{secrets.PUSH_SEND_SECRET}}"}'
npx -y @insforge/cli secrets update VAPID_PRIVATE_KEY --value "$VAPID_PRIVATE_KEY"
npx -y @insforge/cli secrets update VAPID_SUBJECT --value "$VAPID_SUBJECT"
npx -y @insforge/cli schedules update "$PUSH_SCHEDULE_ID" --active true
```

## Tests

No secrets and no real network in the new tests (Deno may download imports initially):

```bash
deno test --no-lock insforge/functions/send-push/index_test.ts
pnpm run test:push-rls
pnpm run type-check
pnpm run lint
pnpm run test:ci --runInBand
pnpm run build
pnpm run validate:static-export
```

Deno verifies the signature with the VAPID public key and decrypts the body with the
receiver's private key; it checks rejection of a bearer without the secret, SSRF,
404/410, errors, partial success and the batch limit. PGlite applies the migration
twice and checks RLS CRUD, RPC privileges, the time window, reservations and
deduplication. It does not reach the project backend.

Real test still pending, with the remote infrastructure configured: subscribe a
browser with the matching public key, confirm its own row and an unread alert that
fell due less than 24 hours ago, close the app and run one cycle. Confirm reception
and that the trip/dashboard opens, `push_sent_at` persisted and no second send when
the cycle repeats. Repeat on Android and on Safari iOS installed as a PWA. Revoke a
subscription and check cleanup after 404/410; force a provider failure and check that
the alert keeps `push_sent_at = null`.
