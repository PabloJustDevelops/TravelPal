# Trip collaboration and permissions

Issue: [#132](https://github.com/PabloJustDevelops/TravelPal/issues/132)

## Summary

Allow a trip owner to invite existing TravelPal accounts as editor or reader, manage membership, and revoke access immediately through RLS. Share trip metadata and trip-scoped records, including journal photos only after Storage object policies are explicitly made membership-aware. Global records remain private. This plan uses in-app invitations to an existing account; it does not send email or create public bearer links.

## Verified current state

- `CONTEXT.md` describes trips and child records; `migrations/20260913181842_create-app-schema.sql` creates `trips`, `expenses`, `notes`, `bookings`, `itinerary_activities`, `tasks`, `alerts`, and `budgets` with owner policies.
- `migrations/20261015120000_enforce-trip-owner-rls.sql` adds parent-trip ownership checks for linked rows. `migrations/20260915160000_create-journal-entries.sql` and `20260915160001_create-journal-photos.sql` add trip-scoped journal data.
- `migrations/20260917120000_storage-objects-owner-only.sql` restricts journal photo storage objects to their owner; a row-level membership change alone will not grant access to image objects.
- `src/lib/insforge.ts` defines browser data types; `src/app/trips/page.tsx`, `src/app/trip/page.tsx`, `src/components/planning/ItineraryPlanner.tsx`, `TripJournal.tsx`, and journal-photo components read/write through the SDK.
- `scripts/test-trip-owner-rls.mjs` uses PGlite to test child `trip_id` ownership. `scripts/test-push-rls.mjs` demonstrates migration idempotency and policy testing patterns.
- ADR-009 and ADR-014 require browser SDK access with RLS and static hosting; no Next route handler can broker invites or permissions.

## Approach

Add `trip_members` with `(trip_id, user_id)` unique membership and `role` constrained to `editor` or `reader`; ownership remains `trips.user_id`, so do not represent owner as a second membership role. The owner alone manages members and can transfer ownership only through a later explicit feature. Resolve invitees by account email in an InsForge function that validates the caller's bearer and owner permission, avoids exposing arbitrary account existence, and writes a pending invitation. A function is needed for email lookup/invitation because direct browser queries must not expose other users' profiles. The user accepts/rejects from an authenticated client; acceptance becomes active membership.

All trip child table policies must authorize reads by active membership and writes by owner/editor, while preserving same-trip integrity. A task has no `trip_id` today; this plan scopes tasks to a trip by adding nullable `trip_id`, keeping null-trip tasks owner-only. Storage access must verify the journal photo's trip membership before serving/uploading, with no public bucket. Keep browser SDK as the data path; use the InsForge function only for invitation lifecycle, not as a data BFF.

Discarded: shareable bearer links (hard-to-revoke, leakable, and require token lifecycle/rate limiting); email-only invitations before an email provider and account binding are confirmed; treating child `user_id` as the authorization boundary (would block invited members and retain ownership leakage).

## Concrete changes

### Phase 1: schema and RLS

- Add a timestamped migration creating `trip_members` and a separate `trip_invitations` table, role/state `text + CHECK`, unique constraints, indexes, FK cascades, grants, RLS, and owner-only member management. Store only the resolved invitee's auth user ID; do not expose account lookup results to clients.
- Add `trip_id` to `tasks`; preserve global tasks when null. Decide whether `alerts` remain private to their creator or are visible to members; default to private unless the owner chooses otherwise.
- Replace owner-only SELECT/INSERT/UPDATE/DELETE policies on `trips` and all trip-scoped child tables with policies using `EXISTS` against `trip_members` and trip owner. Enforce editor/reader distinctions in both `USING` and `WITH CHECK`, and validate each child row's `trip_id` against the parent membership. Preserve private behavior for rows with no trip.
- Include expenses, notes, bookings, itinerary activities, budgets, journal entries, and journal photos. Add migration tests for owner/editor/reader/intruder, cross-trip reassignment, null-trip rows, deletion, and immediate revocation.
- Update `scripts/test-trip-owner-rls.mjs` or add `scripts/test-trip-collaboration-rls.mjs`; ensure CI's `test:trip-owner-rls` continues to cover legacy ownership and new roles.
- Define secure Storage policy for `journal-photos`: validate object path/metadata against the owning journal photo and active trip membership; editor upload/delete, reader download only. Test using the available local policy harness or document remote-only verification if InsForge Storage semantics cannot be modeled locally.

### Phase 2: invitation lifecycle and data model

- Add `insforge/functions/trip-invitations/` with Deno tests. Verify bearer/session, validate request, require trip owner for invite/cancel, use a narrow lookup and avoid returning whether an unrelated email has an account. Do not accept admin API keys from the browser.
- Extend `src/lib/insforge.ts` types and add narrowly scoped client helpers in `src/lib/trips.ts` only if they reduce repeated query mappings (ADR-009's third-use rule applies).
- Add accept/decline flow that uses authenticated SDK calls subject to RLS; prevent a caller from setting their own `user_id`, role, trip owner, or invitation status.

### Phase 3: UI and regression coverage

- Add trip member list, invite by email, role change, remove member, leave-trip, pending invitation inbox, and clear permission-denied states under `src/components/trips/` and the trip detail page.
- Hide/disable write controls for readers based on loaded role, but treat RLS as final authority and handle denied mutations without false success.
- Update all trip list/detail selectors to include trips where the user is owner or active member; ensure owner-only delete controls remain.
- Add Jest tests for UI role gating, Playwright multi-user flow with isolated test accounts, and axe/Storybook checks for invite/member dialogs.

## Tests

- PGlite RLS: owner/editor/reader/intruder on trips and every child table; test both read and each mutation, forged `user_id`, cross-trip IDs, global/null-trip data, removed membership, and role downgrade.
- Function Deno tests: authenticated owner, non-owner, malformed/oversized inputs, duplicate invite, existing membership, and no account-enumeration response.
- Jest: member list, invite state, role gating, owner-only deletion, and mutation errors.
- E2E: two separate accounts; invite, accept, edit as editor, read-only as reader, remove and verify the next query is denied. The flow requires authenticated test accounts and cannot be fully verified with public credentials alone.
- Accessibility: keyboard operation, labels, focus return, and status announcements for invite and role dialogs.
- CI retains lint, type-check, Jest, RLS, Deno function tests/bundles, data-path guard, export, Storybook, Wrangler dry-run, and E2E. No app server route is introduced.

## Risks and blockers

- This is a security-sensitive policy rewrite across many tables; every policy needs positive and negative coverage.
- Existing rows keep owner-only semantics until linked to a trip; ownership and child `user_id` semantics need a deliberate migration rule. Do not rewrite historical `user_id` to the trip owner because that loses the actor identity.
- The current Storage owner-only rule must be changed carefully; direct browser object access may not support a membership lookup in the policy expression. Confirm InsForge Storage policy capabilities before implementing photo sharing.
- Email delivery, account lookup privacy, and invitation expiration depend on InsForge function/runtime capabilities and the selected email service. No provider/account is verified in this repo.
- Realtime updates are not required by the acceptance criteria; revoked access applies on the next query. Do not promise live UI updates without adding a separate subscription design.

## Estimate

**L — 48–72 agent hours.** Migration/RLS design and PGlite tests (18–26h) can run in parallel with UI wireframes/types (10–14h) after the access matrix is fixed. Invitation function (8–12h) and UI integration (12–18h) follow; end-to-end security review/integration (8–12h) is serial.

## Open questions

1. Confirm invite-by-email to existing accounts with private in-app acceptance; this plan excludes bearer links and email delivery.
2. Confirm readers can download journal photos and editors can upload/delete them; this plan includes that access matrix.
3. Should trip alerts be visible to all members or remain private to the user who generated them? Default in this plan: private.

## Acceptance checklist

- [ ] An invited user sees the shared trip and its in-scope child data, and no unrelated users' data.
- [ ] RLS tests cover owner, editor, reader, and uninvited intruder.
- [ ] Removing a member revokes access on the next query.
- [ ] The UI does not offer write actions to readers and handles policy-denied operations truthfully.
