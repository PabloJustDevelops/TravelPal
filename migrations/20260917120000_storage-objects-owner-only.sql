-- Politicas de propietario para storage.objects (issue #68).
--
-- El bucket de las fotos del diario es privado y la app pide urls firmadas
-- (issue #64, ADR-011). Firmar no es autorizar: quien firma es el backend, con
-- la sesion de quien lo pide, y hoy `storage.objects` esta con RLS
-- deshabilitada y cero politicas. En un bucket privado eso significa que
-- cualquier usuario autenticado puede listar, firmar y descargar los objetos de
-- otro; la url firmada de la app no daba privacidad real por si sola.
--
-- La privacidad de una foto son las dos cosas juntas: la url firmada en la app
-- y el dueno del objeto aqui. El dueno es `uploaded_by` (el `sub` del token),
-- no el prefijo de la key: la key lleva el id del usuario por convencion, no es
-- una frontera de seguridad.
--
-- `avatars` sigue siendo publico a proposito (ADR-011). Estas politicas no
-- cambian la visibilidad de ningun bucket: la visibilidad se decide en el
-- bucket, y estas filas gobiernan el acceso autenticado a la tabla.
--
-- Idempotente: se puede aplicar mas de una vez sin romper.

alter table storage.objects enable row level security;

drop policy if exists storage_objects_owner_select on storage.objects;
create policy storage_objects_owner_select on storage.objects
  for select to authenticated
  using (uploaded_by = (select auth.jwt() ->> 'sub'));

drop policy if exists storage_objects_owner_insert on storage.objects;
create policy storage_objects_owner_insert on storage.objects
  for insert to authenticated
  with check (uploaded_by = (select auth.jwt() ->> 'sub'));

drop policy if exists storage_objects_owner_update on storage.objects;
create policy storage_objects_owner_update on storage.objects
  for update to authenticated
  using      (uploaded_by = (select auth.jwt() ->> 'sub'))
  with check (uploaded_by = (select auth.jwt() ->> 'sub'));

drop policy if exists storage_objects_owner_delete on storage.objects;
create policy storage_objects_owner_delete on storage.objects
  for delete to authenticated
  using (uploaded_by = (select auth.jwt() ->> 'sub'));

grant select, insert, update, delete on storage.objects to authenticated;
grant usage on schema storage to authenticated;
