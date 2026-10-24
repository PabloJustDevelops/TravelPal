# ADR-013: Browser push, with delivery in InsForge

## Context

Issue [#48] asks for task, booking and budget alerts that the bell persists in `alerts` to be
delivered outside the app. Next.js is a static export served by Cloudflare Workers Assets; the
sending server must live in InsForge. The initial stage built the service worker, the explicit
permission, the serialisation and the localStorage bridge with no backend. The server assignment of
2026-10-23 lifts that restriction and adds the migration and the function, without enabling remote
infrastructure.

## Decision

- Keep the browser client and the explicit gesture in Settings. Never ask for permission on mount.
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` enters the build from the environment and the GitHub Actions
  variable. The private JWK, the subject and the service secret only live in InsForge.
- Add `push_subscriptions` with a unique endpoint, FK to `auth.users`, owner CRUD RLS, `last_seen_at`
  and explicit privileges for `authenticated` and `project_admin`, with no anonymous access.
- Use `alerts.push_sent_at` instead of a delivery table: the unit of confirmation is the user's alert.
  It is confirmed if at least one service accepts the notice. That is enough to avoid repeating
  completed cycles and keeps a single state per alert. A per-device table is justified when individual
  retries, history or a transition across several keys are needed; today it would complicate the
  contract without a requirement to deliver to every device.
- Add a temporary claim (`push_claimed_at`, `push_claim_token`) independent of the sent mark. The
  administrative RPC claims with `FOR UPDATE SKIP LOCKED`, expires after 5 minutes and does not
  elevate users (`SECURITY INVOKER`). It avoids selecting the same alert simultaneously. On failure it
  keeps the last attempt's date and clears only the token; never-attempted claims go first, and
  retries rotate by attempt age without being lost.
- `send-push` accepts only POST with `X-Push-Secret`, never a user bearer. It consumes up to 10 unread
  alerts expired in the last 24 hours, with subscriptions and `push_sent_at is null`. It does not
  derive new alerts. Each alert uses up to the 20 most recently seen subscriptions.
- Implement VAPID ES256 and RFC 8291 `aes128gcm` with Deno's WebCrypto, with no new npm dependencies.
  An ephemeral encryption key separate from VAPID, a per-send timeout, allowed HTTPS destinations and
  no redirects. The payload stays `{ title, body, url }` for the existing service worker.
- Delete subscriptions on 404/410. Other errors leave the alert pending if nobody accepted the notice.
  A partial acceptance confirms the alert globally, with no per-device retries.
- Schedule every 15 minutes through InsForge, once the secrets are configured and the function is
  published. Commands, operational limits, tests and rotation: [docs/PUSH.md](../PUSH.md).

## Consequences

The migration is new and idempotent; it modifies no applied SQL. The Deno tests check signing and
encryption and the PGlite tests check policies and claims. The tests are not equivalent to real
delivery: the provider's acceptance does not prove that the browser showed the notice.

The mark does not guarantee exactly one delivery: a crash between HTTP acceptance and DB confirmation
can repeat after the claim expires. Alerts older than 24 hours are dropped from the selection to avoid
an avalanche of stale notices. A per-delivery table remains a possible evolution if the requirement
changes. A device outside the 20 most recent does not receive that alert's notice.

The bell is still what generates alerts when the app is opened. Generating them while nobody visits
the app would be separate work. Safari on iOS requires installation as a PWA.

## Status

Implemented in code with server-side delivery, pending activation and real validation. Neither the
migration nor the secrets, the deploy or the schedule have been applied in the backend.

Client persistence implemented: `src/lib/push.ts` uses an upsert by endpoint and the SDK's verified
identity; unsubscribing deletes the user's own row. `usePushNotifications` reconciles when the session
is hydrated and when the account changes, also from the global layout. Settings allows subscribing
when there is a public key and support. SDK errors are shown without misrepresenting the browser
state. Infrastructure activation and the real delivery test are still pending.

[#48]: https://github.com/PabloJustDevelops/TravelPal/issues/48
