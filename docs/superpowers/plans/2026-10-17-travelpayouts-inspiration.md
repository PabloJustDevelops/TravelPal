# Travelpayouts Flight Inspiration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated, static-hosting-compatible Aviasales flight inspiration with private Travelpayouts credentials.

**Architecture:** The static Next.js page invokes an InsForge Edge Function using the existing browser SDK session. The function verifies the bearer token, validates the query, calls the fixed Travelpayouts Data API endpoint, and returns normalized ideas. Its token is configured as an InsForge secret; Cloudflare remains an assets-only Worker.

**Tech Stack:** Next.js 16 static export, React, `@insforge/sdk` 1.5.2, InsForge Deno Edge Functions, Zod, Jest, Deno tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-travelpayouts-inspiration.md`

## Global Constraints

- Production is a static Next.js export served by an assets-only Worker; do not add Next.js Route Handlers or a Cloudflare app server.
- Use `insforge.functions.invoke`; do not extract or store tokens through private SDK APIs.
- Store `TRAVELPAYOUTS_API_TOKEN` only as an InsForge function secret.
- Use `/travel-inspiration`; `/trips/:id` is already redirected by Cloudflare.
- Query the fixed Aviasales Data API endpoint with EUR and economy settings; no live search or booking.
- Do not deploy backend or publish Cloudflare from this PR.

## Review Focus

- Missing, expired, or malformed bearer token: reject before making an upstream request.
- Duplicate, unknown, malformed, and out-of-range query parameters: return a generic validation error.
- Invalid, stale, non-affiliate, or oversized provider rows: discard safely without exposing raw data.
- Provider timeout, non-2xx response, and malformed JSON: return a generic failure without credentials or provider body.
- Direct navigation to `/travel-inspiration` and links to `/create-trip` must avoid the legacy `/trips/:id` redirect and must not save a trip before explicit form submission.

---

### Task 1: Validated Travelpayouts data contract

**Files:**
- Create: `src/lib/travel-inspiration.ts`
- Test: `src/lib/__tests__/travel-inspiration.test.ts`

**Interfaces:**
- Produces `InspirationQuery`, `FlightIdea`, `parseInspirationQuery(params, now)`, `parseFlightIdeas(payload, query, now)`, `isFlightIdeaCurrent(idea, now)`, `filterFlightIdeas(input, query, now)`, and `ideaToTripHref(idea)`.
- Query: uppercase IATA origin, `YYYY-MM` month from current month through +12 months, journey `round-trip | one-way`, optional finite EUR max price in `(0, 100000]`.
- Idea: origin/destination IATA, future departure and optional return dates, positive EUR amount, foundAt/validUntil instants, and changes count.

- [ ] **Step 1: Write failing Jest tests** for valid query parsing, unknown/repeated fields, invalid origin/month/price, fresh versus stale and invalid provider rows, query filtering, deduplication, top-12 cap, expiry, and safe trip URL generation.
- [ ] **Step 2: Run the focused test** with `pnpm exec jest src/lib/__tests__/travel-inspiration.test.ts --runInBand`; confirm the new module is missing and tests fail for that expected reason.
- [ ] **Step 3: Implement the contract** with Zod; cap the provider envelope at 1000 rows, keep only EUR data with `actual` and `show_to_affiliates`, discard data older than 48 hours, sort ascending, deduplicate, and return at most 12.
- [ ] **Step 4: Run the focused test** and confirm all assertions pass.

### Task 2: Authenticated InsForge Edge Function

**Files:**
- Create: `insforge/functions/travel-inspiration/index.ts`
- Test: `insforge/functions/travel-inspiration/index_test.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- `POST` with JSON `{ checkOnly?: boolean, origin?: string, month?: string, journey?: "round-trip" | "one-way", maxPrice?: number }`.
- Success response: `{ status: "unavailable" | "available" | "ready", ideas?: FlightIdea[], checkedAt?: string }`.
- Errors: `401` unauthenticated, `400` invalid request, and generic `503` for configuration/provider failure.
- The exported request handler accepts injectable auth verification, config, fetch, and clock dependencies for deterministic tests; the default adapter constructs the InsForge SDK client from `Authorization` and reads secrets via `Deno.env`.
- The source imports Task 1's shared parser by relative path; before deployment, `deno bundle --platform deno --packages bundle --external npm:@insforge/sdk` inlines local/shared dependencies into the single file accepted by `insforge functions deploy` while preserving the SDK runtime import.

- [ ] **Step 1: Write failing Deno tests** for preflight, method rejection, auth rejection before provider fetch, missing config, check-only behavior, valid normalized response, timeout, oversized/malformed response, provider errors, and absence of secret/provider details in response bodies.
- [ ] **Step 2: Run `deno test --allow-env --allow-net insforge/functions/travel-inspiration/index_test.ts`** and confirm the expected missing-function failure.
- [ ] **Step 3: Implement the function** using the Task 1 parser, validate bearer via `auth.getCurrentUser()`, allow only the production origin and local development origins, require a configured enable flag and token, send token only in `X-Access-Token`, use fixed HTTPS host, timeout, no redirects, and bounded response reading.
- [ ] **Step 4: Add `denoland/setup-deno@v2` pinned to Deno `2.9.7`, run the Deno test, and bundle the function to `$RUNNER_TEMP`** in CI's `build` job; keep function deployment out of pull-request and Cloudflare deploy workflows.
- [ ] **Step 5: Run `deno test --allow-env --allow-net insforge/functions/travel-inspiration/index_test.ts`** and confirm all assertions pass.

### Task 3: Static inspiration page and trip handoff

**Files:**
- Create: `src/app/travel-inspiration/page.tsx`
- Create: `src/components/trips/FlightInspiration.tsx`
- Test: `src/components/trips/__tests__/FlightInspiration.test.tsx`
- Modify: `src/app/trips/page.tsx`
- Modify: `src/components/layout/DashboardLayout.tsx`
- Test: `src/components/layout/__tests__/DashboardLayout.test.tsx`
- Modify: `src/app/create-trip/page.tsx`
- Test: `src/app/trips/__tests__/page.test.tsx`
- Test: `src/app/create-trip/__tests__/page.test.tsx` (or the existing test location if present)

**Interfaces:**
- The page requires an authenticated user and calls `createInsforgeClient().functions.invoke("travel-inspiration", { body })`; the browser never calls Travelpayouts directly.
- Inputs are origin IATA, month, journey type, and optional max price; show loading, empty, unavailable, error, and ready states with manual trip creation as fallback.
- Each result shows destination, orientative price, observation time and expiry; actions open Aviasales and link to `/create-trip?source=inspiration&origin=...&destination=...&departure=...&return=...`.

- [ ] **Step 1: Add failing component tests** for sessionless state, check-only invocation, valid query submission, empty/error states, expiry refresh, UI cooldown, and escaped result links; verify no direct fetch to Travelpayouts.
- [ ] **Step 2: Add failing trip-page tests** that an inspiration query prefills title/origin/destination/reference dates, malformed query is ignored, and submit remains explicit.
- [ ] **Step 3: Run the focused Jest tests** and confirm the new component/behavior failures.
- [ ] **Step 4: Implement the static page and navigation links** at `/travel-inspiration`, avoiding `/trips/*` and using existing components and styles; add the item to the navigation array in `DashboardLayout.tsx`.
- [ ] **Step 5: Prefill `/create-trip` from validated inspiration parameters** by reading `window.location.search` in a client effect (no server query dependency or static prerender break), without changing default form behavior or triggering an insert until submit.
- [ ] **Step 6: Run the focused Jest tests** and confirm all assertions pass.

### Task 4: Deployment and operator documentation

**Files:**
- Create or modify: `docs/TRAVEL_INSPIRATION.md`
- Create or modify: `docs/DECISIONS/ADR-015-inspiracion-de-viajes-insforge.md`
- Modify: `docs/DECISIONS/ADR-009-camino-unico-sdk-en-navegador.md` only if needed to reference the new InsForge function exception.
- Modify: `scripts/validate-static-export.mjs` only if it needs an explicit `/travel-inspiration` asset assertion.

**Interfaces:**
- Document the exact `deno bundle` plus InsForge CLI deployment commands, backend secret names, flag location, approval limitations, and a manual authenticated smoke-check without printing credentials.
- Keep Cloudflare deploy assets-only and do not use the GitHub Travelpayouts secret/variable as runtime config.

- [ ] **Step 1: Add `/travel-inspiration` to `criticalRoutes`** in `scripts/validate-static-export.mjs`; the existing validator will require its exported HTML and `_redirects` file.
- [ ] **Step 2: Document setup and operations**: set `TRAVELPAYOUTS_API_TOKEN` as an InsForge secret, configure `TRAVELPAYOUTS_ENABLED` in the function environment, deploy slug `travel-inspiration` through InsForge CLI, confirm status active, and note that Travelpayouts project/program approval remains external.
- [ ] **Step 3: Record the hosting/auth decision** in ADR-015; do not alter the current static Worker architecture.
- [ ] **Step 4: Run `pnpm run validate:static-export`** and confirm the generated route exists without conflicting with `public/_redirects`.

### Task 5: Integration verification and review

**Files:**
- Verify the complete diff; no additional files expected.

- [ ] **Step 1: Run** `pnpm run type-check`, `pnpm run lint`, focused Jest tests, focused Deno tests, and `pnpm run validate:static-export`.
- [ ] **Step 2: Run the relevant Playwright flow** for direct route navigation and the create-trip handoff against the generated static artifact.
- [ ] **Step 3: Review the full branch diff** for credential exposure, stale OpenNext route assumptions, redirect collisions, and accidental changes outside Travelpayouts.
- [ ] **Step 4: Have an independent reviewer inspect the final diff** before opening a PR; do not merge or deploy production as part of this work.
