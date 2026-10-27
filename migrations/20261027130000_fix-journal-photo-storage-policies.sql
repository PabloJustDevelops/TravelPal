-- Corrige las politicas de Storage de la migracion 20261026120000.
--
-- Aquella version exigia, para insertar en el bucket `journal-photos`, que ya
-- existiera la fila correspondiente en public.journal_photos. Pero la app sube
-- primero el objeto y despues inserta la metadata (JournalPhotos.tsx: upload ->
-- insert), asi que la subida quedaba denegada y el diario dejaba de funcionar:
-- e2e/flows/journal-photos.spec.ts no encontraba la imagen.
--
-- La politica vuelve a ser aditiva respecto a la de 20260917120000:
--   * insert: solo el propio objeto (no se puede validar el viaje antes de que
--     exista la metadata; la tabla journal_photos ya limita a que viaje se ata).
--   * select/update/delete: el propietario del objeto o, en `journal-photos`,
--     quien tenga acceso al viaje de la foto (editor en update/delete).
--
-- Idempotente.

drop policy if exists storage_objects_owner_select on storage.objects;
create policy storage_objects_owner_select on storage.objects
  for select to authenticated using (
    uploaded_by = (select auth.jwt() ->> 'sub')
    or (bucket = 'journal-photos' and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()))
    ))
  );

drop policy if exists storage_objects_owner_insert on storage.objects;
create policy storage_objects_owner_insert on storage.objects
  for insert to authenticated with check (
    uploaded_by = (select auth.jwt() ->> 'sub')
  );

drop policy if exists storage_objects_owner_update on storage.objects;
create policy storage_objects_owner_update on storage.objects
  for update to authenticated
  using (
    uploaded_by = (select auth.jwt() ->> 'sub')
    or (bucket = 'journal-photos' and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid())
             and member.role = 'editor')
    ))
  )
  with check (
    uploaded_by = (select auth.jwt() ->> 'sub')
    or (bucket = 'journal-photos' and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid())
             and member.role = 'editor')
    ))
  );

drop policy if exists storage_objects_owner_delete on storage.objects;
create policy storage_objects_owner_delete on storage.objects
  for delete to authenticated using (
    uploaded_by = (select auth.jwt() ->> 'sub')
    or (bucket = 'journal-photos' and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid())
             and member.role = 'editor')
    ))
  );
