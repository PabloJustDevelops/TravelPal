# Native mobile app

Issue: [#134](https://github.com/PabloJustDevelops/TravelPal/issues/134)

## Summary

Create a separately maintained Expo/React Native application in a workspace package, initially targeting iOS and Android with sign-in, trip list/detail, itinerary read/write, and task editing. Reuse pure TypeScript domain contracts where practical; do not import web components or make the mobile app depend on the Next build. Use the same InsForge project and RLS. Native push, journal photos, budgets, expenses, offline mode, and public store release are later phases unless separately approved. A reproducible internal test distribution is in scope.

## Verified current state

- `package.json` is a single Next.js 16.3.8/React 19 web package managed by pnpm 12.3.4; there is no mobile workspace or native build pipeline.
- `src/lib/insforge.ts` contains the shared TypeScript data interfaces and `createInsforgeClient()` browser client. `src/lib/auth.ts` supplies web auth flows; Google auth callback is web-routed.
- `src/app/trips/page.tsx`, `src/app/trip/page.tsx`, `src/app/tasks/page.tsx`, and `src/components/planning/ItineraryPlanner.tsx` implement relevant web workflows against the browser SDK.
- Migrations use owner RLS (`migrations/20260913181842_create-app-schema.sql` and follow-up migrations); no mobile-specific service role or API is needed.
- Push is currently browser Web Push via `public/sw.js`, `src/lib/push.ts`, `insforge/functions/send-push/`, and `migrations/20261023120000_browser-push-server.sql`; this is not APNs/FCM delivery.
- `playwright.config.ts` tests the web static export. `.github/workflows/ci.yml` has no native build/signing job. `docs/DECISIONS/ADR-014-cloudflare-static-assets-worker.md` governs only web hosting.

## Approach

Use Expo with React Native and TypeScript in `apps/mobile/`, with pnpm workspace configuration and a small `packages/domain/` for platform-neutral types/validation extracted only where both clients need them. The repository's `@insforge/sdk` is 1.5.2, but the official TypeScript docs consulted do not confirm React Native support or a native secure-storage adapter, and the current docs are not versioned to 1.5.2. Make the SDK/device spike a hard gate: use that SDK only if the installed version is verified on both platforms; otherwise use InsForge's documented mobile REST auth/data APIs behind a small typed adapter, with secure token persistence and refresh rotation. Never implement token handling from assumptions, and never put an InsForge admin key in the app. Keep membership authorization in RLS. The documented REST auth flow requires secure refresh-token storage and persisting rotated tokens ([InsForge REST auth](https://github.com/insforge/insforge/blob/main/docs/sdks/rest/auth.mdx)); official Kotlin SDK docs describe `SessionStorage`, but that is not evidence of TypeScript SDK support ([Kotlin SDK installation](https://github.com/insforge/insforge/blob/main/docs/snippets/kotlin-sdk-installation.mdx)). InsForge also announces official Swift and Kotlin SDKs ([mobile SDK announcement](https://insforge.dev/blog/swift-kotlin-sdks-launch)).

Before implementation, verify the pinned `@insforge/sdk` React Native support and persistence API against version-matched official docs and run a minimal device authentication spike. If unsupported, implement the documented REST integration in the adapter or switch the platform choice to official native SDKs after an owner decision; do not invent token plumbing. Google OAuth must use native provider flow/deep links and be validated with the InsForge project configuration.

Discarded: wrapping the existing web export in a WebView (does not deliver native navigation/security/storage or meaningful native behavior); separate Swift/Kotlin apps (duplicates TypeScript domain and triples platform maintenance); rewriting the web app around universal components (high-risk scope expansion).

## Concrete changes

### Phase 0: platform and SDK spike

- Create a throwaway branch/prototype in `apps/mobile/` for Expo boot, InsForge SDK initialization, secure session persistence, email sign-in, sign-out, and session restoration on physical iOS/Android devices.
- Confirm Google sign-in redirect/deep-link configuration and SDK support. Document official API references and supported versions in `docs/mobile/`.
- Select Expo SDK, React Native version, minimum OS versions, and account ownership after confirming compatibility with the current monorepo; do not upgrade the web React/Next versions as a side effect.

### Phase 1: workspace and app foundation

- Add pnpm workspace definition and root scripts for mobile lint/type-check/test/start/build without changing existing web commands.
- Add `apps/mobile/` Expo config, app navigation, environment validation for only public InsForge URL/anon key, auth screens, and secure token persistence.
- Extract shared interfaces and pure validation to `packages/domain/` only when imports can remain platform-neutral; web code continues to work without a native runtime.
- Configure deep links for auth callback and trip links. Add app-level loading, signed-out, offline/network error, and session-expiry states.

### Phase 2: first useful workflows

- Implement trip list and trip detail using browser/device SDK queries with explicit user-scoped filters and RLS as authorization; no API key or custom BFF.
- Implement itinerary list/create/edit and task list/status/priority edit. Use existing data constraints and timezone behavior; preserve IDs so edits are visible in the web app.
- Add native accessibility labels, screen-reader order, dynamic text sizing, keyboard behavior, and platform-safe touch targets.
- Keep budgets, expenses, journal/photo upload, offline sync, and push outside v1 until cost and API spikes are understood.

### Phase 3: test distribution

- Add unit tests for shared domain code and mobile screens; add RLS regression coverage against the same policy migrations, not a mobile-specific authorization bypass.
- Add Maestro or Detox for critical device flows after stack selection; retain Playwright for web.
- Add reproducible unsigned/simulator builds in CI first. Add signed TestFlight and Play internal tracks only after Apple/Google developer accounts, signing assets, and secrets are provided.
- Document local setup, simulator/emulator, physical-device auth callback testing, build artifacts, release steps, and support matrix under `docs/mobile/`.

No schema migration is required for initial mobile access. Native push would require a separate APNs/FCM design and backend function/migration; the existing `send-push` browser subscription flow cannot satisfy it.

## Tests

- Unit tests: domain parsing/validation, auth session lifecycle, screen loading/error states, and optimistic mutation rollback.
- RLS: retain web PGlite/SQL RLS tests and add device-backed integration using two accounts to prove identical visibility and mutation rules. Never test with service-role credentials in app code.
- E2E: mobile automation on simulator/emulator for sign-in, list trips, edit a task, relaunch and verify persistence; real device smoke test for OAuth and secure persistence.
- Web regression: existing Playwright E2E, Jest, static export and validator stay unchanged. Mobile CI jobs must not weaken or skip the root CI gates.
- Accessibility: native screen-reader labels/order, dynamic type, contrast, and touch target checks on the critical screens. No Apple/Google account is needed for unit or simulator checks; signed distribution requires accounts.

## Risks and blockers

- The official docs checked do not establish React Native support for the repo's pinned SDK version. Version-matched documentation and the Phase 0 device spike decide whether to use the JS SDK or REST adapter. Web singleton assumptions in `src/lib/insforge.ts` cannot be copied blindly.
- Google OAuth native configuration requires provider console redirect/deep-link configuration and physical-device validation.
- Store or internal testing distribution requires Apple/Google accounts, signing credentials, bundle identifiers, and owner approval. Do not commit signing keys.
- Push is not portable from current browser Web Push. APNs/FCM requires separate server credentials, token lifecycle, and user/device registration design.
- Offline writes and conflict resolution are intentionally out of v1; users need clear connectivity errors.
- A separate app expands release and dependency maintenance. Pin the mobile toolchain and keep web CI isolated.

## Estimate

**L (largest roadmap item) — 100–150 agent hours through reproducible internal test builds, excluding account setup and store review.** SDK/device spike (12–20h) is an initial gate. Workspace/domain extraction (12–18h) and auth/navigation (20–28h) can partially parallelize after that gate. Trip/itinerary/tasks (30–42h), device tests/accessibility (16–24h), and CI/docs/distribution (18–26h) are sequential integration phases.

## Open questions

1. Confirm Expo/React Native and iOS plus Android as the target; this plan assumes both.
2. Confirm v1 scope as trips, itinerary, and tasks only; this plan defers expenses, budgets, journal/photos, offline mode, and native push.
3. Who owns Apple/Google developer accounts and signing, and is internal distribution acceptable before public store release?

## Acceptance checklist

- [ ] A real device signs in, lists trips, and edits a task against the production backend.
- [ ] The app observes the same RLS isolation and data as the web client.
- [ ] There is a reproducible build path (CI or documented script) and a test distribution path.
