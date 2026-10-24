# TravelPal · layout 1 integration

Date: 13 October 2026. Worktree: `codex/auth-brand-a11y`, associated with PR #94. Scope of this iteration: the landing and its tests; it does not change authentication logic or the private modules.

## Reference and comparison

The reference chosen by Pablo is the attached layout 1 image. Original: 1487 × 1058 px. Implementation: 1440 × 1024 CSS px viewport, deviceScaleFactor 1; equivalent aspect ratio. The mobile variant was checked at 390 × 1024 px. The final screenshots open the page without an anchor, wait for the fonts and save from the top; the scrolled screenshots from the first passes are not reused.

- [Reference](docs/design/assets/layout1-2026-10-13/reference.webp).
- [Desktop light](docs/design/assets/layout1-2026-10-13/desktop-light.webp).
- [Desktop dark](docs/design/assets/layout1-2026-10-13/desktop-dark.webp).
- [Mobile light](docs/design/assets/layout1-2026-10-13/mobile-light.webp).
- [Mobile dark](docs/design/assets/layout1-2026-10-13/mobile-dark.webp).

## Fidelity surfaces

| Surface | Check and result |
| --- | --- |
| Typography | Real Inter: 117.36 px and 115.013 px line-height for the headline at 1440 px, measured in the browser. Both lines and the reference hierarchy are kept; on mobile the second line wraps without overflow. The destination note uses the existing Fraunces italic instead of imitating the mock's handwritten lettering. |
| Layout and spacing | Light header, headline over the landscape, panorama without a card and a horizontal example strip. On mobile, actions come before the landscape and the stops are stacked. The excess mobile whitespace observed in the first review was removed. |
| Colours | Atlas tokens from the repository: light background, ink, neutrals and blue for actions; the same variables keep the dark variant. Axe reports no violations on the evaluated routes and themes. |
| Images | Panorama created with ImageGen from the original illustration and the approved mock. WebP 1774 × 887, 323360 bytes, real alpha; no screenshot containing text is used as a background. `sizes` accounts for the 200vw framing on mobile to avoid an image that is too small. Images load in the tests. |
| Content | Headline, subheading, CTA, destination and three stops from the mock. The values are labelled `Viaje de ejemplo`. They are not user data and are not stored. The following sections explain existing features without repeated cards or testimonials. |

## Interaction and motion

On-screen labels quoted below are the literal strings from the components.

`Crear mi viaje` opens `/signup`; `Entrar` opens `/signin`; `Ver un ejemplo` goes to `#example`. The three stops can be selected with mouse and keyboard: arrows, Home and End, focus and selected state. The panel explains the selected stop and changes with a 180 ms transition; the global reduced-motion rule removes the displacement. There are no loops, no scroll locking and no animations repeated per section. Switching to `Alojamiento` was tested in the app browser.

The detail panel and the selected underline are a functional adaptation of the static mock. The existing Button, tokens and Heroicons icons are used. No new dependencies or backend are introduced.

## Resolved issues and minor differences

- The design system's global test rejected new native buttons; the tabs now use the shared `Button`, which forwards the ref.
- The first mobile framing left too much transparent sky; it was compacted and captured again.
- The first screenshots could keep the mobile menu anchor; the final capture returns to `/` and waits for the fonts.
- P3: the annotation typeface and the icon silhouettes are not identical to the generated raster. The real system fonts and icons are kept; they are not placeholders. The panorama is a derivation of the original illustration, not a pixel-for-pixel match.

No P0/P1/P2 open. Independent read-only review: no findings, including the final use of Button.

## Validation executed

```bash
pnpm exec jest --runInBand --coverage=false
```

Output 0: `Test Suites: 64 passed, 64 total`; `Tests: 460 passed, 460 total`. There are pre-existing console warnings from mock/act tests; they are not hidden as a fully silent output.

```bash
NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder INSFORGE_API_KEY=qa-placeholder E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test e2e/smoke/landing-auth-layout.spec.ts e2e/smoke/signup-accessibility.spec.ts e2e/smoke/signin-controls.spec.ts --project=smoke --workers=1
```

Output 0: `27 passed (31.2s)`. Covers landing, signin, signup, recovery and reset at 390/1440 px in light and dark, axe, loaded images, absence of overflow, the example's keyboard interaction and prefers-reduced-motion. Fictional environment; it does not validate real signups, emails or resets.

```bash
pnpm exec eslint src/components/landing src/app/page.tsx e2e/smoke/landing-auth-layout.spec.ts e2e/smoke/signup-accessibility.spec.ts
pnpm run type-check
git diff --check
```

ESLint: output 0 with no messages. TypeScript: output 0, `$ tsc --noEmit`. Diff check: output 0 with no messages.

```bash
IMPECCABLE_HOME=/tmp/travelpal-impeccable-cache /tmp/travelpal-impeccable-20261013/.agents/skills/impeccable/scripts/impeccable detect --json src/components/landing/Hero.tsx src/components/landing/Navbar.tsx src/components/landing/ExampleJourney.tsx src/components/landing/Features.tsx src/components/landing/HowItWorks.tsx src/components/landing/CTA.tsx src/components/landing/Footer.tsx src/components/landing/Brand.tsx
```

Output 0: `[]`. Official detector run from a temporary copy; no hooks were installed. Its result does not replace the visual comparison.

## Delivery

- Landing integrated and final screenshots inspected.
- Routes, example controls and menu checked.
- Light and dark, keyboard, reduced motion and tests passing.
- Assets with alt, credit and provenance in `public/images/atlas/README.md`.
- No commit, push, merge or deploy in this delivery.

Result of this delivery: `passed` for the landing; it does not represent the global visual gate.

## List/create and planning

The list and create flows keep filters, authentication, date validation and partial budget; the PR's authenticated E2E tests passed before this planning stage. Planning keeps its queries and mutations; calendar, cards and forms have stories and tests. The booking story checks actions inside a 390 × 844 viewport. Evidence for this stage: `docs/audits/2026-10-11-atlas-planificacion.md`. The authenticated E2E on the module's final state is still to be run, and the global visual gate is still to be completed.

final result: blocked

The authenticated E2E of the full page remains pending on the integrated state, and the global visual gate remains blocked.

Overall result: `blocked` until both gates are completed.
