# ADR-006: Amadeus is retired and flights are entered by hand

## Context

The app had a live flight search: `GET /api/flights/search`, a route handler that validated the
parameters with zod and called the Amadeus API (`src/lib/amadeus.ts`, OAuth token from
`client_credentials`, endpoint `v2/shopping/flight-offers`). The UI was `TravelSearch`, a modal
mounted in the navigation bar that rendered up to five offers and persisted nothing: the
"Ver Oferta" button had no `onClick` and no offer ever reached `trips` or `bookings`.

Two facts end the life of that integration:

- The handler does not require a session. It never calls `requireUser()`; with invalid parameters
  it answers 400, never 401. It is an open proxy: anyone could spend the provider's quota.
- The provider no longer exists for this project. Amadeus retired its (free) self-service portal
  on 17 July; only the commercial Enterprise portal remains. The alternatives checked do not work:
  Aviationstack gives 100 requests/month free (useless) and 49.99 $/month for 10,000; AirLabs has
  no serious free tier.

In addition, the [SPA vs Next audit](../audits/auditoria-spa-vs-next.md) and issue #38 counted
`flights/search` among the endpoints that had to survive (because it used a server secret), and
#38 set "Stage 1" as adding `requireUser()` to it. That premise no longer holds: protecting a proxy
to a retired provider fixes nothing.

## Decision

1. The proxy is deleted, not authenticated. `src/app/api/flights/search/route.ts`,
   `src/lib/amadeus.ts`, `src/lib/flightService.ts` and `TravelSearch` disappear, along with its
   mounting in the navigation bar and the `AMADEUS_*` variables in `src/lib/env.ts` and
   `.env.example`. A guard test fails if the proxy or its client reappears.
2. The flight is entered by hand as a booking. `bookings` is reused with `type = 'flight'`, which
   already has cost, currency, date, time, confirmation, an FK to `trips` and owner RLS. Four
   nullable columns are added (`airline`, `flight_number`, `origin`, `destination`) in a new
   migration. No new table is created and `trips` is not touched.
3. Autocomplete calls no one. Airlines and airports come from an open dataset packaged as a static
   file: airports from OurAirports (public domain) and airlines from OpenFlights (ODbL, with
   attribution). No keys and no network at runtime.
4. Price inspiration is written down, not implemented. The Travelpayouts (Aviasales) Data API is
   free but needs an account and a token from the owner: it belongs in its own spec (#41).

### Alternatives considered

- Adding `requireUser()` to the proxy (what #38 said): it closes the hole but leaves an endpoint
  calling a provider that no longer exists. Discarded.
- Storing the flight in `trips` without a migration: the trip form already asks for airline, flight
  number, origin, destination and date/time, but `trips` has no price and a flight is not a trip:
  the cost would be lost and the booking would not appear in planning or the calendar.
- A dedicated `flights` table: cleaner for several legs, but it requires a table, RLS policies, UI
  and new endpoints for a single leg. Discarded on cost.
- A paid flight API (Aviationstack, AirLabs): discarded on cost and quota.

## Consequences

- The app loses live flight search. It is a real loss of functionality, accepted: it was not a
  flight planner and it persisted nothing.
- `bookings` gains four nullable columns. No new policies or grants are needed: the `bookings`
  policies are per row (`auth.uid() = user_id`) and the table grants already cover the new columns.
- Issue #38 must be updated: its Stage 1 goes from "add `requireUser()`" to "delete the endpoint",
  and `flights/search` leaves its table of surviving endpoints. `auth/refresh` survives (the `chat`
  proxy is also retired; see [ADR-008](ADR-008-retirada-del-asistente.md)).
- The documents that cited Amadeus (`README.md`, `docs/ARCHITECTURE.md`, `docs/TECHNICAL.md`,
  `docs/MCPs.md`) are corrected. The audit is left as history with a note at the end.
- Any future flight price that is not the one the user types will come from a cached source
  (Travelpayouts) and will live on the server, with its own secret and its own decision.

## Status

Accepted
