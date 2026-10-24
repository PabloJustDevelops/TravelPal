# TravelPal visual continuity guide

Updated on 16 October 2026. Read together with `CONTEXT.md` and
`docs/DECISIONS/ADR-008-atlas-claro.md`. ADR-008 supersedes ADR-007.
This document records the current system; it does not replace product issues.

## Approved direction

Atlas: a clear tool for preparing and following a trip. The landing chosen by
Pablo on 13 October has a large headline, an action blue and a panoramic
Mediterranean illustration. Its reference is at
`docs/design/assets/layout1-2026-10-13/reference.webp`.

Inside the app the user's work leads: next trip, itinerary days, tasks, amounts
and notes. Private headings are more compact than the marketing headline. Do not
carry the landscape or the landing composition into every form or list.
Destination images must correspond to real data; synthetic examples are limited
to Storybook and tests.

## Brand

- The TravelPal mark is the **TP ligature** chosen on 19 October 2026 among the six
  proposals in `docs/design/logo/proposals/`. It rests on a single solid form — the `T` and the `P`
  share a stem — and works at 16 px.
- Files: `src/app/icon.svg` (app icon and favicon, mark in white on `accent` `#0759d3`),
  `public/brand/travelpal-mark.svg` (standalone mark, inherits colour through `currentColor`) and
  `public/brand/travelpal-lockup.svg` (mark + "TravelPal", with a dark variant through
  `prefers-color-scheme`).
- Use the mark in a single colour when the background is not light paper: `currentColor` already
  resolves it. Do not recolour it with state colours or place it in gradients, shadows or
  decorative containers.
- The outlined wordmark is at `docs/design/logo/proposals/03-ligadura-tp-outlined.svg`; the proposal
  version with `<text>` must not be used on published surfaces.

## Tools and existing contracts

- Next.js 16, React 19, Tailwind 4; Inter for the interface. Fraunces is still loaded
  for compatibility with older surfaces; it is not the typeface for new modules.
- Local components in `src/components/ui`: `Button`, `Input`, `Card`,
  `PageTitle`, `EmptyState`, `ErrorState` and shared field classes.
- Headless UI for dialogs, Heroicons for icons, Framer Motion where animated
  interaction exists; dnd-kit, react-calendar and Recharts in their modules.
- shadcn/Base UI is decided as a progressive addition and is **not installed**
  as of this date. Do not describe the local components as shadcn. Add a control
  when it provides a required contract; keep the tokens and verify keyboard,
  focus, labels and states. Do not replace the whole dialog base at once.
- Storybook + Vitest in Chromium + axe for components; Jest for logic and pages;
  Playwright for routes and authenticated flows. Do not add another UI framework
  for aesthetics.

## Composition rules

- One `PageTitle` header per page: title, useful explanation and primary action.
  Filter controls come after it; on mobile they stack without overflowing.
- `DashboardLayout`: `surface` background; `paper` content, `line` border, radii of
  8–12 px. `Card` does not lift on hover. Do not nest cards only to separate text.
- Private headers 24–32 px, section title 18–20 px, body 14–16 px.
  Inter, semibold weight for hierarchy; amounts in tabular figures.
- Use `ink`, `muted`, `accent`, `success`, `warning`, `danger` and their surfaces.
  Blue distinguishes actions; state colours communicate facts. Ordinary categories
  are identified by text or icon, not by a rainbow palette.
- Edit actions reachable and visible without hover; targets of at least 44 px
  on card controls. Do not put a button inside a link.
- `CardTitle` accepts `headingLevel`: use level 2 under the page title and level
  3 under a section. Keep one `h1` per route. The shared empty state uses `h2`.
- Forms: associated labels, `fieldStyles` classes, errors with `role=alert`,
  focus visible also on visually hidden radios. Keep validation and submission.
- Motion brief and tied to state: colour and focus, opening, progress. No elevation,
  rotation or staggered entrance per card. Respect `prefers-reduced-motion`.

## Module status after this pass

| Module | Composition and changes | Verification that requires a real session |
|---|---|---|
| Dashboard | Next trip before the report; shared header and background | Current/future trip, filters, errors and multiple currencies |
| Trips | Shared header and states; detail keeps itinerary and journal, clear semantic light/dark state | Populated list, create/edit/delete, journal with photos |
| Planning | Shared header; neutral planner categories, existing bookings and calendar | Create/edit/reorder activities and bookings |
| Tasks | Neutral columns with a state line; cards without shadow or rotation; mobile selector and change without dragging | State persistence, edit/delete, long list |
| Expenses | Amount and description first; visible editing, neutral category; tokenised and labelled forms | Create/edit/delete, receipts, filters and different currencies |
| Budgets | Coherent surface; named actions with touch size; adaptable rows | Totals, over-budget and periods. `/budget` redirects to `/expenses` |
| Notes | Title and text before metadata; visible named editing; semantic editor error | Saving, categories/favourites/filters. `/notes/[id]` redirects to the list |
| Profile | Shared header, more compact avatar, labelled fields and semantic colours | Editing, cancel, avatar upload and failure |
| Settings | Coherent section titles and accessible hierarchy | Automatic theme, push permissions and security states |

The visual verification of this pass runs on real components with synthetic
Storybook data. It is not equivalent to an authenticated audit of every route.
See `docs/qa/audits/2026-10-14-private-revamp.md` for evidence and limits.

## Continuing in another chat

1. Read this guide, ADR-008 and the latest QA report; check `git status` and `git diff`.
   Work may be uncommitted in a worktree; do not assume it is on `main`.
2. Confirm the worktree and the running server before changing files. Do not overwrite
   other people's changes to charts, tests or audits. Pick one module and its flow.
3. Capture the real route at 1440 and 390 px, light and dark, with empty and test data.
   Use a test environment or account; never put demo data on production screens.
4. Read its components, call sites and tests. Keep services, session, RLS, routes,
   currency conversions and prop contracts. Do not invent maps, bookings or totals.
5. Run Jest, TypeScript, lint and the affected stories; test the full flow with
   Playwright. Save screenshots and an independent review before claiming closure.
6. Update this document's status and the report with commands, output and exit
   code. An access limitation is recorded as a blocker, not as a passed test.

Base commands (test environment variables, never real keys in the report):

```bash
pnpm run type-check
pnpm exec jest --runInBand --coverage=false
pnpm exec vitest run --project=storybook
pnpm run storybook
```

## Authentication · option 2 Travel desk

Selection approved by Pablo on 16 October: authoritative reference stored at
`docs/design/assets/auth-mesa-2026-10-16/reference.png`. Signup and signin use
an editorial composition: brand and account link at the top, large headline and
notebook still life on the left, form directly on paper on the right.
`AuthShell` takes `mode="signup" | "signin"`; without `mode` it keeps the previous
recovery and reset composition. Do not reuse the mockup as a background.

Inter and the existing Atlas tokens; local controls and Heroicons. shadcn/Base UI
and any other library are not installed. Field and Google borders derive from
`muted` and `paper` to distinguish controls, errors with alerts and associated
description, password targets of 48 px. Passwords keep their rules and strength
meter; OTP keeps paste, focus, cooldown and resend. Services, callbacks and
sessions do not change. The account link moves to the foot of the form and is
repeated in the desktop header; on mobile the whole promotion and its image are
hidden.

New asset: `public/images/atlas/auth-travel-notebook.webp`, gouache with real alpha.
Prompt and provenance in the assets README. The previous square notebook is kept
as a historical exploration. The new illustration interprets the chosen still
life; it does not depict a real trip. Dark mode uses the same semantic tokens.

QA for this delivery: `docs/qa/audits/2026-10-16-auth-mesa/design-qa.md`. Do not
confuse it with the root `design-qa.md`, which documents only the 13 October
landing.

## Atlas interior · ten approved screens

Implemented on 16–17 October in the worktree `auth-brand-a11y/travelpal`: dashboard, trips, trip creation, planning, tasks, expenses, expense create/edit, notes, profile and settings. References in `docs/design/proposals/interior-atlas-2026-10-16/`; planning uses the corrected calendar.

The private shell fixes paper/navy/blue, Inter, a 240 px sidebar and 28/38 px headings; it keeps the authentication WIP and the landing. Open compositions, list by state in tasks, split notes editor and reactive summaries in forms. Calendar and board, reports, export and real services are kept. Do not add invented destinations, amounts or images to production code.

Authenticated QA against an isolated local InsForge, with empty and populated data at 1440/390, light and dark, plus edit states: 96 views with no axe issues and no horizontal overflow. Jest 477 tests, Playwright 25, TypeScript, lint (13 pre-existing warnings) and the OpenNext build on Node 22.22.3 exit with code 0. Evidence, visual comparison and limits: `docs/qa/audits/2026-10-16-interior-atlas/design-qa.md`.

Activity reordering writes only the order, with conditions and compensation; it is not a server transaction. Notes keep the pending-change protection. No commit, push or deploy was made in this delivery.
