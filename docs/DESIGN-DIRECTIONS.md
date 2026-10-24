# Visual directions

> Historical comparison, prior to Atlas. ADR-007 was superseded by
> [ADR-008](DECISIONS/ADR-008-atlas-claro.md). The token and screen descriptions in
> this document reflect that starting point, not the current code. The guide in force
> to continue the design work is [DESIGN.md](../DESIGN.md).

## Starting point

The system has just been closed. This is what exists today, and it conditions the
three directions:

| Piece | Current state |
|---|---|
| Tokens | Only `--background` and `--foreground`. No color scale of its own: every color is a raw Tailwind utility written in the component (`gray-*`, `blue-600`, `red-600`). |
| Typography | Inter, declared once in `src/app/layout.tsx` with `next/font`. |
| Skin | `rounded-lg` cards with a 1px border and `shadow-sm`; small radii; a single blue accent (`blue-600`). |
| Dark mode | `.dark` class, resolved in `ThemeContext`. 9 of 22 pages have their own `dark:` classes; the other 13 only inherit whatever their components bring. |
| Guard | `src/__tests__/design-system.test.ts` fixes the contract: one spinner, one field class, one primary button, one icon library, one typeface. |

Two consequences that apply to all three directions:

- The guard is tied to the values, not only to the shape. The test requires the list of
  files containing the line `bg-blue-600` plus `hover:bg-blue-700` to be exactly
  `["src/components/ui/Button.tsx"]`. Changing the accent forces editing the test at
  the same time as the button, not afterwards.
- Typography goes through a bottleneck. The test requires a single
  `next/font/google` import and the `<body>` to keep carrying `inter.className`.
  Adding a headline face is valid if it goes in the same import line; replacing Inter
  breaks the contract.

Supporting figure: there are 242 uses of surface utilities (`bg-blue-*`, `text-blue-*`,
`border-blue-*`, `rounded-*`, `shadow-*`) across 58 files. That is what has to be swept
in any direction.

## Direction A — Travel notebook

(editorial, warm)

The idea. The app reads like a travel magazine: content rules and the interface almost
disappears, with generous whitespace and strong typographic hierarchy. The trip stops
being a record and becomes a story worth showing.

Typography. Two families: a headline serif (Fraunces or Newsreader) with body text in
Inter. Generous scale — headings at 32–40px, line height 1.6, measure of 65–75
characters, no negative tracking.

Palette.

| Use | Light | Dark |
|---|---|---|
| Paper / background | `#FBF8F3` | `#14120F` |
| Surface | `#F3EDE3` | `#1E1B16` |
| Ink | `#1A1815` | `#EFE9DE` |
| Secondary text | `#6B655C` | `#B9B0A2` |
| Line | `#E4DCD0` | `#332E26` |
| Accent (action) | `#B45309` | `#E8A33D` |
| Success / warning / error | `#2F6F5E` / `#A16207` / `#9F1239` | `#4E9C86` / `#C99A2E` / `#C7546B` |

Space and cards. Space is the material: 48–80px of padding between sections. Cards are
plates, not boxes: no border, no shadow, a 1px rule as separator and a 2–4px radius.
Covers bleed edge to edge. No gradients and no hover elevation; movement is reserved for
content that enters.

Real reference. [Condé Nast Traveler](https://www.cntraveler.com) — high-end travel
editorial, serif typography and full-bleed photography. As a brand-tone reference,
[Away](https://www.awaytravel.com), which sells object and story at once.

## Direction B — Control room

(utilitarian, precise)

The idea. A dense, precise interface, almost an engineering tool: hierarchy is built
with weight and color, not size. The app takes pride in speed and in no data getting in
the way, not in pretty photos.

Typography. Inter only (already in place), tracking of −0.011em, compact scale: 12 / 13
/ 14 / 20px. Headings are not large; they are dark and bold.

Palette.

| Use | Light | Dark |
|---|---|---|
| Background | `#FFFFFF` | `#08090A` |
| Surface | `#F7F8F8` | `#101113` |
| Surface 2 | `#EEF0F1` | `#17181B` |
| Ink | `#08090A` | `#F7F8F8` |
| Secondary / tertiary | `#6F7680` / `#8A8F98` | `#9BA1AA` / `#6F7680` |
| Line | `#E4E6EA` | `#23252A` |
| Accent | `#5E6AD2` | `#7C86E0` |
| Success / warning / error | `#3E9B4F` / `#C08A00` / `#C52828` | `#4FB463` / `#D9A01C` / `#E05A5A` |

Space and cards. High density: 32–36px rows, 12–16px padding, 6–8px radii. Shadow only
on what floats (modals, menus); at rest, a 1px border and a slightly different
background. Lists and tables ahead of card grids. Dark mode is not an extra: it is where
this direction breathes.

Real reference. [Linear](https://linear.app) — the interface and its public
documentation are the reference pattern for "dense but readable" (measured contrast, a
single accent, minimal movement).

## Direction C — Postcard

(showcase, consumer)

The idea. Large photography, rounded cards and warm color: this is the direction that
sells the destination best. The management side is still there, but every trip gains a
cover worth sharing.

Typography. Inter throughout (400/500/600), with the option of a dedicated display face
for headings. Headings at 24–30px in 600, without reaching for the serif.

Palette.

| Use | Light | Dark |
|---|---|---|
| Background | `#FFFFFF` | `#121212` |
| Surface | `#F7F7F7` | `#1E1E1E` |
| Ink | `#222222` | `#EDEDED` |
| Secondary | `#717171` | `#A8A8A8` |
| Line | `#DDDDDD` | `#2E2E2E` |
| Accent | `#FF5A5F` | `#FF7A7E` |
| Success / warning / error | `#008489` / `#E0A800` / `#C13515` | `#22A0A6` / `#F0BE33` / `#E3725A` |

If changing the accent is too expensive now, the cheap variant is to keep the blue and
raise it: `#2563EB` with `#1D4ED8` on hover, and a teal secondary `#008489`. Half the
character is lost, not the showcase.

Space and cards. Large radii: 16px on cards, 24px on modals and sections, 999px on
chips. Three shadow levels (rest, hover, floating) instead of one. Canonical card: 16:9
image on top, title, metadata, and elevation on hover. Regular 8px rhythm, plenty of air
but predictable.

Real reference. Airbnb and its Design Language System, documented by the person who
designed it: [Airbnb DLS — Karri Saarinen](https://karrisaarinen.com/dls/). As a travel
app reference that is a showcase without ceasing to be a tool: [Flighty](https://flighty.com)
(Apple Design Award).

## Which one fits and which one I recommend

A and C both fit "a travel app that also wants to be a showcase". B is an excellent
tool and a poor showcase: its merit is not getting in the way, and that does not come
across in a screenshot.

I recommend C, Postcard. Three reasons:

1. It is the only one that holds up both faces of the product. A planner has expense
   tables, analytics charts and a task board: B handles them well and fails the
   showcase; A handles them badly (a dense table in serif at 1.6 line height reads
   worse, not better). C puts the showcase where it belongs — covers, listings, landing
   — and leaves the interior neutral.
2. It is the cheaper of the two that work. It reuses Inter as is, the existing
   `rounded-lg` card and the `Button` structure: it is a change of tokens and radii, not
   of architecture. A also requires a new type pairing and redoing the hierarchy of
   every heading.
3. Half the work is already done. The 9 pages with `dark:` and the `dark:bg-gray-800`
   of the cards are closer to a `#1E1E1E` surface than to A's paper `#14120F` and
   `#1E1B16`.

If the goal were brand differentiation above cost, I would choose A: it is the only one
that looks like nothing else in the sector. And if the goal were efficiency for a user
who records data every day, B would be the right answer — but then the showcase should
be given up explicitly.

## What would have to change, and how much

None of the directions lands in the app with a `globals.css` change alone. Order of
magnitude in work for one person:

### A — Travel notebook · large

- `globals.css`: new token set (paper, ink, lines, accents) plus the six state colors.
- `layout.tsx`: add the headline face in the same `next/font/google` import and keep
  `inter.className`; if Inter is replaced, the guard has to be edited.
- `Button.tsx` and `fieldStyles.ts`: accent, radii and heights. `Button.tsx` no longer
  contains `bg-blue-600` plus `hover:bg-blue-700`, so the guard fails and that assert
  has to be rewritten.
- `Card.tsx`: remove border and shadow, move to a plate. `PageTitle`, `EmptyState` and
  `ErrorState` inherit the change.
- Sweep of the 58 files / 242 uses of `rounded-*`, `shadow-*` and `gray-*`.
- Also: the 13 pages without their own `dark:` need the new dark palette to reach their
  surfaces.

### B — Control room · medium

- `globals.css`: gray scale and surfaces in `@theme inline` (finally a token instead of
  hand-written `gray-800`), plus density.
- `Button.tsx`, `fieldStyles.ts`, `Card.tsx`: 6–8 radius, 1px border and shadow only on
  what floats. Same guard warning as in A.
- `PageTitle` and the states: lower heading sizes.
- Density in `Calendar.tsx`, `TaskBoard.tsx` and the analytics and expense tables.
- Dark mode is half done: the 9 pages with `dark:` are untouched, the other 13 are not.

### C — Postcard · medium

- `globals.css`: accent, radius scale and three shadow levels as tokens.
- `Button.tsx`, `fieldStyles.ts`: accent and radius. Same guard warning: changing the
  accent breaks the primary button assert.
- `Card.tsx`: `rounded-2xl` and a rest shadow. It drags in `PageSkeleton` and the
  per-domain cards (`TripCard`, `ExpenseCard`, `NoteCard`, `BudgetCard`, `BookingCard`,
  `AlertCard`).
- Unify the existing asymmetry: `DashboardLayout` uses `dark:bg-black` while
  `Card`/`Modal`/`Toast` use `dark:bg-gray-800`; with a real surface scale this is
  solved once.
- The showcase part — the trip cover — needs a new field in `trips` and a migration; it
  is the only piece that leaves the CSS.

In all three, the sensible order is the guard's order: tokens → atoms (`Button`, field,
`Card`) → states and headers → page sweep. That order already worked when closing the
current system.

## Status

Decided. The chosen direction is A, Travel notebook, recorded in
[ADR-007](DECISIONS/ADR-007-rumbo-cuaderno-de-viaje.md), which fixes the palette, the
typography, the shared components, the shell and the dark mode behavior. This document
remains as history: it keeps the three proposals and their comparison, but is not
re-decided. The recommendation for C above was dropped in favor of brand
differentiation.

## References

- [Condé Nast Traveler](https://www.cntraveler.com) — travel editorial.
- [Away](https://www.awaytravel.com) — travel brand with an editorial story.
- [Linear](https://linear.app) — tool density and precision.
- [Airbnb DLS, by Karri Saarinen](https://karrisaarinen.com/dls/) — Airbnb's design
  system.
- [Flighty](https://flighty.com) — showcase travel app (Apple Design Award).
