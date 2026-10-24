# ADR-010: The planner persists per operation, with no save button

## Context

The planner's "Guardar Itinerario" button promised to save and did not save: its `onSave` ended in
a `logger.debug` with a TODO comment. Triage of [#60] measured the real scope: there was no `insert`
into `itinerary_activities` anywhere in the app. The table was only read, moved (date drag in the
calendar) and deleted; for a new user, activities could not be born. The insert existed as code in
`insforge-functions.ts`, was never wired to the UI and was removed with the rework (commit
`bf2b32f`), so the itinerary surface was left half done.

The triage left the outcome as a product decision, with three routes: persist the whole itinerary
with the button, retire the surface, or an intermediate route. The first drags along four problems
that the triage itself listed:

- Day notes without a column: they were edited and rendered, but there is no table or column where
  they live; `getTripItinerary` forced them to `""`. Saving the whole itinerary would lose them
  silently or require a migration.
- Two id vocabularies: the planner invented ids (`activity_<ts>_<rand>`) while database rows have
  uuids; saving everything without distinguishing them sends synthetic ids as uuid.
- Local state out of sync: `useState(itinerary)` with an effect that only filled it when empty; with
  "save everything", that resurrects rows deleted from the calendar and skips reloads.
- Lossy round-trip: the mapping reads neither `address` nor `order_index` and the modal does not
  collect an address (dead columns in the schema).

## Decision

The intermediate route is adopted: persistence per operation. Each create, edit and delete in the
planner writes its row into `itinerary_activities` at that moment, and the "Guardar Itinerario"
button disappears with its promise. The whole itinerary is not persisted in one go.

1. One write per operation, with the pattern the page already used for deletion and calendar drag:
   `withQueryTimeout` (15 s ceiling, [#56]) + `assertRowsAffected` (zero rows is a typed failure,
   [#53]) + `refetch`. The create uses `insert([{ ... }])` (the SDK takes an array), `.select()` and
   fills `user_id`, `trip_id`, `date`, `title`, `description`, `start_time`, `end_time`, `location`,
   `category`, `cost`, `currency`, `notes`, `completed` and `order_index`.
2. The parent executes the SDK; the planner does not. The `onCreateActivity`, `onUpdateActivity` and
   `onDeleteActivity` callbacks are `Promise<void>`: the page runs the query and throws the error; the
   planner manages per-operation save state and translates the failure with the existing helpers
   (`queryErrorKind`, `CONNECTION_TIMEOUT_MESSAGE`, `getErrorMessage`). No loose `Promise<void>` and no
   swallowed errors. The single path of [ADR-009] is kept: the SDK directly, with no new endpoints.
3. A single id vocabulary. Synthetic generation is removed: `id` is always the uuid of the persisted
   row. Edit and delete send that uuid; create sends no id (the database generates it and it arrives
   through `refetch`).
4. The source of truth is the server. The planner stops keeping a local copy of the activities
   (`currentItinerary` disappears) and renders the `itinerary` it receives. Its local state is left
   for ephemeral UI: selected day, open modal and form. That way a reload is reflected and a row
   deleted from the calendar does not come back.
5. The day is identified in ISO. `generateTripDays` used `formatDate` (a localised Spanish date) as
   the day key, while the schema (`date date`) and the page mapping use `yyyy-MM-dd`; without fixing
   it, neither the load matched nor was the `date` insert valid. Keys become `yyyy-MM-dd` and are
   parsed locally with `parseISO`.
6. Day notes leave the UI. They have no column and no table and this ADR creates no migration: the
   planner's text area is removed so as not to promise what is not saved.

## Consequences

- `itinerary_activities` stops being a table without a writer: the third case noted by the
  [utility and rework audit](../audits/auditoria-utilidad-y-rework.md) is closed (after `alerts` and
  `reminders`/`calendar_events`).
- The "review the draft and then save" flow is lost: every operation is immediate. That is the price
  of the chosen route and the reason for choosing it: less surface and no false promises.
- Day notes are lost in the UI until it is decided whether they deserve their own table. No data is
  lost: they were not persisted.
- `address` and `order_index` still have no surface in the modal (it does not collect them).
  `order_index` is filled on create with the position in the day; `address` remains a column without
  a writer.
- The modal's default currency goes from `USD` to `EUR`, which is the schema default, so as not to
  save a currency different from the declared one.

## Status

Accepted

[#53]: https://github.com/PabloJustDevelops/TravelPal/issues/53
[#56]: https://github.com/PabloJustDevelops/TravelPal/issues/56
[#60]: https://github.com/PabloJustDevelops/TravelPal/issues/60
