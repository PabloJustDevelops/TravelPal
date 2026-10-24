# ADR-008: Clear atlas, centred on the trip

## Status

Direction approved by Pablo on 10 October 2026: "1 · Clear and centred on the trip".

It replaces the palette and editorial hierarchy of ADR-007. It keeps its semantic tokens, the Inter
typeface, the shared controls and dark mode support.

## Decision

- White background, cool neutral surfaces, blue for navigation and actions, green for success.
- Side navigation from 1024 px; a dropdown menu on mobile with links of at least 48 px.
- A panel centred first on the trip in progress or the nearest future departure, with access to its
  detail.
- Existing account data and filters. No fictional dates, tasks, destination photos or amounts from
  the sketch in the app.
- Inter for headlines and body; Fraunces stays available for screens still to be migrated.

## Migration

First delivery: tokens, shell and next trip, on top of the pnpm/Storybook base from the
infrastructure PR. The charts and the report remain available.

After that: trip detail and itinerary, tasks and expenses, notes, authentication and landing. Each
module keeps its routes and contracts, adds empty/error/loading states, and passes keyboard,
contrast, mobile and E2E before replacing the previous one.

The selected image guides composition and hierarchy; the first delivery is not a full reproduction.
It adds no map, photography, budget or tasks to the panel without a real flow and a real data source.

## Risks

Screens with local colours and fonts require QA during their migration. No map library has been
chosen or installed. shadcn/Base UI will be adopted control by control when it improves the existing
contract; Headless UI is not replaced wholesale.
