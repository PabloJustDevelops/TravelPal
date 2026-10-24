# ADR-007: The visual direction is "Travel journal" and it is implemented through tokens

## Context

The design system had just been closed when three directions were written for the app's skin
(`docs/DESIGN-DIRECTIONS.md`): A, Travel journal (editorial, warm); B, Control room (utilitarian,
dense); C, Postcard (showcase, consumer). The document did not decide: it proposed, and it
recommended C on cost.

What existed, measured against the tree:

- Tokens: only `--background` and `--foreground`. Everything else was raw Tailwind utilities
  written in the component.
- Raw colour use: 904 uses of palette utilities (`bg-*`, `text-*`, `border-*` from `gray`, `blue`,
  `red`, `green`, `yellow` and the category families) spread across 71 files. Any direction applied
  screen by screen is a sweep of that size.
- Typography: Inter, declared once in `layout.tsx` with `next/font`.
- Dark mode: 9 of 22 pages with their own `dark:` classes and 13 without them; the shell used
  `dark:bg-black` while card, modal and notice used `dark:bg-gray-800`. There was no surface scale:
  there were two different decisions living together.
- Guard: `src/__tests__/design-system.test.ts` fixes the contract (one spinner, one field class, one
  primary button, one icon library, one typeface) and also ties it to values: it requires that
  `bg-blue-600` + `hover:bg-blue-700` exist only in `Button.tsx`.

Two further facts condition the decision:

1. There is a full functional rework on the table. It is not known which screens survive, so
   spending effort painting them one by one is investing in something that may disappear.
2. The product's first impression is the landing page, which today is a dark template with a
   gradient, rounded cards and shadows: the opposite of the editorial direction.

## Decision

Direction A, Travel journal, is implemented, and it is implemented at the foundations layer
(tokens, shared components and shell), not screen by screen. What is decided:

1. Palette in three layers inside `globals.css`. (1) Raw palette in `:root` and `.dark`: paper
   `#FBF8F3`, surface `#F3EDE3`, ink `#1A1815`, secondary `#6A645B`, line `#E4DCD0`, accent
   `#AC4F09` and the three states (success `#2E6D5C`, warning `#8D5606`, danger `#9F1239`).
   Secondary, accent, success and warning are one step darker than the direction's original values,
   the minimum adjustment for their text pairs to exceed 4.5:1 (the e2e tests with axe watch this).
   (2) Semantic tokens in `@theme inline` (`background`, `surface`, `line`, `ink`, `muted`, `accent`,
   `accent-hover`, `accent-soft`, `on-accent`, `success`, `warning`, `danger`) plus sheet radii
   (2–4px), a section spacing scale (3rem / 5rem), an editorial type scale and a reading scale of
   1.6. (3) Compatibility aliases: the raw Tailwind scales (`gray`, `blue`, `red`, `green`, `yellow`)
   are redefined with the direction's palette, so the 904 raw uses inherit the direction without
   repainting screen by screen.

2. Typography in a single import. The headline serif (`Fraunces`) is added in the same
   `next/font` import as Inter, following the warning in the directions document itself: a second
   import breaks the contract. Text stays in Inter on `<body>`; the serif is exposed as a variable
   and `globals.css` resolves it in `font-serif`, so no component declares font families.

3. Shared components as sheets. Button, field, card, headers, empty and error states, notice,
   spinner, modal and page skeleton stop asking for colour by raw scale and ask for it by token.
   The card loses border and shadow and uses a 1px rule as a separator concentrated in the primary
   action class; links that act as buttons (landing, CTA) rely on that same class instead of copying
   the accent.

4. Shell and landing. Dashboard bar and layout on paper with a rule; the dashboard bar loses the
   gradient, the gradient logo and the floating pill group. The landing page becomes a full-bleed
   cover with a flat veil (no gradient), serif headlines, section rhythm by token, no elevation and
   no `hover:scale`.

5. Dark mode: light first. Dark is not a different skin, it is the literal inverse of paper
   (background `#14120F`, surface `#1E1B16`, ink `#EFE9DE`, line `#332E26`, accent `#E8A33D`) and it
   is resolved entirely through tokens, so the shell and the shared components change mode without
   any screen declaring its own `dark:`. A per-mode `color-scheme` is added and the theme is applied
   before the first paint (no light flash).

6. The guard is updated on purpose, not bypassed. It is a contract: the accent changes, so the two
   asserts that fixed it change. They are rewritten to point at the shared class (`actionStyles.ts`)
   and the field, a requirement is added that button and links rely on that class, and a new block
   fixes the direction: the palette lives in tokens in light and in dark, `color-scheme` for both
   modes, the theme before painting, the serif by variable, and shared components not returning to
   the raw scale.

Out of scope for this decision: repainting pages and domain components. The 904 raw page uses are
still there; what changes is that they now resolve to the direction's palette.

### Alternatives considered

- Direction C, Postcard (the one the directions document recommended). Discarded: it is cheap and
  it sells the destination well, but it is a showcase skin with three shadow levels and 16px radii,
  and the stated goal became brand differentiation, not cost.
- Direction B, Control room. Discarded: it is an excellent tool and a poor showcase, and it
  explicitly gives up on selling; the landing page is today the product's showcase.
- Sweeping the 904 uses, file by file. Discarded on cost and risk: with a functional rework
  pending, part of that work is thrown away. The scale aliases achieve the same visual effect at a
  fraction of the cost and leave the sweep for when it is known which screens survive.
- Removing dark mode instead of resolving it. Discarded: taking away a user preference is a product
  decision, and the inverse of paper is half as coherent as light. The preference stays and its
  behaviour is defined.
- Replacing Inter with the serif, or declaring a second font import. Discarded outright: it breaks
  the typography contract and makes the expense tables harder to read.

## Consequences

Positive:

- The direction reaches the whole app (the 904 raw uses resolve to the new palette) without
  repainting a single screen. Verified in the compiled CSS: no default Tailwind value from the
  redefined scales is left.
- New code asks for colour by name (`bg-surface`, `text-ink`, `border-line`, `bg-accent`), so the
  next change of accent or paper happens in one place.
- Dark mode no longer has two truths: shell, components and native controls follow the chosen mode
  and there is no flash on load.
- The guard now protects the direction, not only the shape.

Negative, and accepted debt:

- The raw Tailwind scales no longer mean what their name says: `blue-600` is the direction's accent,
  not a blue. This is documented in `globals.css`; new code must not use them.
- Screen asymmetry remains: several pages carry loose utilities (`bg-white`, `dark:*`) that are not
  part of the system. They are fixed or disappear with the functional rework (see the functional
  rework spec), not in this decision.
- The categorical colour families (violet, orange, pink, indigo, emerald) and the charts' fixed hex
  values are not touched: they are data code, not chrome. They remain candidates for their own ramp
  if the rework keeps analytics and expenses.
- A palette change now requires updating the guard in the same commit. This is intentional.

## Status

Accepted. The palette and editorial hierarchy described here were superseded by ADR-008 (atlas claro);
the rest of the direction still applies.

