-- Evita que un usuario relacione filas propias con viajes de otra persona.
-- El propietario de la fila sigue validandose con user_id; cuando trip_id no
-- es nulo, el viaje referenciado debe pertenecer al mismo usuario.
-- Las referencias opcionales permanecen permitidas en expenses, notes,
-- bookings, itinerary_activities, alerts y budgets. Las dos tablas del diario
-- requieren un viaje.

-- Referencias opcionales.
drop policy if exists expenses_insert_own on public.expenses;
create policy expenses_insert_own on public.expenses
  for insert with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );
drop policy if exists expenses_update_own on public.expenses;
create policy expenses_update_own on public.expenses
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes
  for insert with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );
drop policy if exists notes_update_own on public.notes;
create policy notes_update_own on public.notes
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists bookings_insert_own on public.bookings;
create policy bookings_insert_own on public.bookings
  for insert with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );
drop policy if exists bookings_update_own on public.bookings;
create policy bookings_update_own on public.bookings
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists itinerary_activities_insert_own on public.itinerary_activities;
create policy itinerary_activities_insert_own on public.itinerary_activities
  for insert with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );
drop policy if exists itinerary_activities_update_own on public.itinerary_activities;
create policy itinerary_activities_update_own on public.itinerary_activities
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists alerts_insert_own on public.alerts;
create policy alerts_insert_own on public.alerts
  for insert with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );
drop policy if exists alerts_update_own on public.alerts;
create policy alerts_update_own on public.alerts
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists budgets_insert_own on public.budgets;
create policy budgets_insert_own on public.budgets
  for insert with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );
drop policy if exists budgets_update_own on public.budgets;
create policy budgets_update_own on public.budgets
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      trip_id is null
      or exists (
        select 1 from public.trips as parent_trip
        where parent_trip.id = trip_id
          and parent_trip.user_id = (select auth.uid())
      )
    )
  );

-- Referencias obligatorias del diario.
drop policy if exists journal_entries_insert_own on public.journal_entries;
create policy journal_entries_insert_own on public.journal_entries
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id
        and parent_trip.user_id = (select auth.uid())
    )
  );
drop policy if exists journal_entries_update_own on public.journal_entries;
create policy journal_entries_update_own on public.journal_entries
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id
        and parent_trip.user_id = (select auth.uid())
    )
  );

drop policy if exists journal_photos_insert_own on public.journal_photos;
create policy journal_photos_insert_own on public.journal_photos
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id
        and parent_trip.user_id = (select auth.uid())
    )
  );
drop policy if exists journal_photos_update_own on public.journal_photos;
create policy journal_photos_update_own on public.journal_photos
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id
        and parent_trip.user_id = (select auth.uid())
    )
  );
