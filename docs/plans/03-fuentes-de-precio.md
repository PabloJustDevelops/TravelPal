# Additional transport price sources

Issue: [#133](https://github.com/PabloJustDevelops/TravelPal/issues/133)

## Summary

Add one real non-flight transport source through an InsForge Edge Function, normalize its offers to a provider-neutral contract, and display them in the existing inspiration experience. The first release is gated on choosing a provider and obtaining its credentials. Do not build multiple unselected adapters or claim mock responses are real provider integration.

## Verified current state

- `docs/DECISIONS/ADR-015-inspiracion-de-viajes-insforge.md` records the static route/function pattern and says Travelpayouts account approval, credentials, secrets, and deployment are not verified.
- `insforge/functions/travel-inspiration/index.ts` validates the bearer, inputs, provider token, and normalized response; `index_test.ts` tests behavior with mocked provider responses.
- `src/lib/travel-inspiration.ts` defines the existing flight contract and mapping; `src/app/travel-inspiration/page.tsx` and `src/components/trips/FlightInspiration.tsx` provide UI and trip handoff.
- `.github/workflows/ci.yml` runs Deno tests and bundles the existing functions. InsForge function deployment is separate from static-site deployment.
- Hosting/data constraints are documented in `AGENTS.md`, ADR-009, ADR-014, and ADR-015: credentials stay in InsForge secrets; no Next route handler or Worker runtime.

## Approach

Select exactly one rail provider for the first milestone, after owner approval and account/terms review. Implement a `TransportOffer` normalized type and one provider adapter behind the existing `travel-inspiration` function, keeping the current flight integration intact. The adapter returns only validated fields needed by the UI; UI renders by `mode` with a shared card and routes offers into the existing trip-creation handoff. Add a short-lived function-side cache only if provider terms permit caching; otherwise apply explicit per-user/request rate limiting and bounded timeouts. Do not store user search data or provider credentials in the browser.

Use the existing function rather than a new function per rail for this first provider: one endpoint keeps validation, authentication, and normalized response behavior together, while adapters can later split if provider quotas or deployment isolation justify it. Verify provider's API and terms before committing to cache duration or attribution requirements.

Discarded: frontend direct provider calls (would expose credentials and bypass server validation); generic multi-provider framework before a second provider is selected (unneeded surface); fabricated “real data” based on fixtures (does not meet acceptance).

## Concrete changes

### Phase 1: provider decision and contract

- Owner selects provider, target transport mode, geographic coverage, attribution requirements, and credential/account owner. Record documented quotas, rate limits, caching restrictions, and production access prerequisites.
- Extend `src/lib/travel-inspiration.ts` with discriminated transport mode and normalized offer fields (provider-neutral title, route, departure/arrival, duration, price/currency, deep link, attribution). Retain a flight-specific adapter for current results.
- Add input validation for mode, origin/destination, date, passenger count if relevant, and bounded request sizes. Never let a client select an arbitrary URL or provider endpoint.

### Phase 2: InsForge function adapter

- Extend `insforge/functions/travel-inspiration/index.ts` with one provider adapter and environment flag; store API credentials only as InsForge function secrets.
- Add timeout, response size/schema validation, safe error categories, rate limiting or cache keyed by normalized public search fields, and no-store behavior for user-specific data.
- Update `index_test.ts` with recorded fixtures for success, no results, malformed payload, timeout, rate limit, quota exhaustion, upstream 5xx, and forbidden secret leakage. Fixtures verify contract, not external connectivity.
- Update the Deno bundle step only if the existing bundle command cannot handle the selected SDK/runtime API; otherwise keep CI configuration untouched.

### Phase 3: UI integration

- Extend `src/app/travel-inspiration/page.tsx` and `src/components/trips/FlightInspiration.tsx` (or extract a shared offer component after confirming reuse) with a transport selector and normalized cards.
- Keep loading, empty, disabled-provider, quota, and temporary failure states distinct. Continue allowing flight search when the new source fails.
- Preserve the existing “create trip” handoff and include the selected mode and offer summary without creating a booking or claiming a reservation.
- Add Jest/Storybook fixtures and one Playwright flow with a deterministic function stub or a dedicated test mode that cannot reach paid provider endpoints.

No database migration or RLS change is expected for search-only offers. Add one only if a separately approved feature persists searches or bookings; that is outside this issue.

## Tests

- Deno unit tests run without provider credentials for validation, normalization, timeouts, errors, and secret handling.
- Jest tests cover UI modes, normalized display, provider failure degradation, and handoff.
- Playwright tests against the static export use deterministic mocked results; production-backed provider behavior is verified separately with an approved account.
- Accessibility: keyboard selection of mode, labeled search fields, offer card links, and announced result/error states; Storybook a11y checks for empty/error/success states.
- CI continues to run Deno function tests/bundles, lint, type-check, Jest, RLS, timezone, static export validator, SEO/header checks, Storybook, Wrangler dry-run, and E2E. No provider secret is required in CI; use fixtures.

## Risks and blockers

- Provider selection, commercial terms, account approval, API credentials, quotas, and any affiliate/deep-link agreement are external blockers.
- Provider search APIs can return stale or approximate fares; label prices as indicative and link to the provider for confirmation.
- Cache retention and attribution must follow the chosen provider's current terms; the repo cannot verify these before selection.
- A secret configured in InsForge does not prove the deployed function uses the current code; separate deployment and a real smoke call are required.
- The app must degrade if the provider is disabled or unavailable and must not break existing flight inspiration.

## Estimate

**M — 24–36 agent hours, plus external onboarding time.** Contract and UI work (8–12h) can proceed with fixtures while provider onboarding runs. The adapter (8–12h) depends on approved API documentation; end-to-end integration and real smoke check (8–12h) require credentials and deployment.

## Open questions

1. Which single provider and transport mode should ship first, and who owns its account/credential?
2. Are affiliate attribution/deep links required for v1, and who approves provider terms?
3. May the function cache provider offers, and what freshness limit is acceptable? Default: cache only if provider terms explicitly allow it.

## Acceptance checklist

- [ ] At least one selected source returns real data through an InsForge function.
- [ ] The UI shows the new source's offers using the shared inspiration card design.
- [ ] Quota, empty, and provider outage errors degrade without breaking the page.
- [ ] Provider tokens are stored as InsForge secrets and do not appear in the client bundle or export.
