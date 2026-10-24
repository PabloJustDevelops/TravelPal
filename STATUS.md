# TravelPal status

Snapshot of the repository as of 2026-10-24, on `main` at `18d7d9c`. This document records a review; it
does not pin the future SHA of `main` and it does not replace the CI runs as evidence.

## Product state

| Area | State |
| --- | --- |
| Account, sign-in, password recovery, Google sign-in | Working in production |
| Trips, itinerary, bookings, journal and photos | Working in production |
| Tasks, notes, expenses and budgets | Working in production |
| Dashboard, accessibility, light/dark themes | Working in production |
| Flight inspiration (Travelpayouts) | Working: InsForge function deployed, provider token stored as a secret, verified with real provider responses |
| Browser push | Client flow and `send-push` function deployed; end-to-end delivery on a real device not verified |
| Native mobile app | Not started |

No open issues at the time of this review.

## Architecture

- The user data path is the InsForge SDK in the browser, with RLS enforcing per-user isolation. The old
  BFF is gone; `src/app` has no route handlers (ADR-009, ADR-012).
- Production is a static Next.js export served as an assets-only Worker (`wrangler.jsonc`). There is no
  Next.js server in production; `@opennextjs/cloudflare` is declared but unused.
- External integrations live in InsForge edge functions: `travel-inspiration` and `send-push`.
- The visual direction "travel journal" (ADR-007) is applied to foundations and shared components.

## CI and testing

- CI (`.github/workflows/ci.yml`) runs `build`, `worker-build` and `e2e` on every pull request, and
  `deploy` plus `e2e-produccion` only on pushes to `main`.
- Jest covers units and components (79 suites, 588 tests); Vitest runs the Storybook interaction tests;
  Playwright runs 69 end-to-end tests against the exported artifact served by `wrangler dev`.
- The `e2e` job supervises `wrangler dev` (`scripts/e2e-server.mjs`) and restarts it when the session
  dies. This mitigates an open upstream defect where the dev server stops accepting connections mid-run
  (`cloudflare/workers-sdk#15203`); it is a mitigation, not a fix, and a crash costs one retried test.

## Pending work

| Item | Condition | Reference |
| --- | --- | --- |
| Push delivery on a real device | Verify the end-to-end path with a browser profile and a valid subscription | ADR-013 |
| Internationalisation | Decide whether the static export ships one locale or several | `README.md` roadmap |
| Trip collaboration | Design invitations and permissions on top of RLS | `README.md` roadmap |
| Functional rework from the utility audit | Decide which findings are worth implementing before choosing a visual direction | `docs/audits/auditoria-utilidad-y-rework.md` |

Test-only users created by the sign-up E2E flow still need a separate administrative cleanup mechanism.
