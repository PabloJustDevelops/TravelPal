-- Colaboracion por viaje (#132): membresias, invitaciones y RLS por rol.
-- Idempotente: tablas/columnas/indices IF NOT EXISTS y policies recreadas.

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'reader')),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index if not exists idx_trip_members_user_id on public.trip_members (user_id);
create index if not exists idx_trip_members_trip_id on public.trip_members (trip_id);

create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'reader')),
  state text not null default 'pending'
    check (state in ('pending', 'accepted', 'rejected', 'revoked')),
  created_at timestamptz not null default now(),
  check (invited_user_id <> invited_by)
);

create unique index if not exists idx_trip_invitations_pending_unique
  on public.trip_invitations (trip_id, invited_user_id)
  where state = 'pending';
create index if not exists idx_trip_invitations_invited_user_state
  on public.trip_invitations (invited_user_id, state);

alter table public.tasks add column if not exists trip_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_trip_id_fkey'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_trip_id_fkey
      foreign key (trip_id) references public.trips(id) on delete cascade;
  end if;
end $$;
create index if not exists idx_tasks_trip_id on public.tasks (trip_id);

alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
grant select, insert, update, delete on public.trip_members, public.trip_invitations to authenticated;

-- Evita recursividad RLS: las policies de viajes consultan membresias y las de
-- gestion de membresia deben comprobar el propietario sin volver a leer trips
-- sujeto a su propia policy.
create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips as parent_trip
    where parent_trip.id = target_trip_id
      and parent_trip.user_id = (select auth.uid())
  )
$$;
revoke all on function public.is_trip_owner(uuid) from public;
grant execute on function public.is_trip_owner(uuid) to authenticated;

drop policy if exists trip_members_select_allowed on public.trip_members;
create policy trip_members_select_allowed on public.trip_members
  for select to authenticated using (
    user_id = (select auth.uid())
    or public.is_trip_owner(trip_id)
  );
drop policy if exists trip_members_insert_owner on public.trip_members;
create policy trip_members_insert_owner on public.trip_members
  for insert to authenticated with check (
    public.is_trip_owner(trip_id)
  );
drop policy if exists trip_members_update_owner on public.trip_members;
create policy trip_members_update_owner on public.trip_members
  for update to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));
drop policy if exists trip_members_delete_owner on public.trip_members;
create policy trip_members_delete_owner on public.trip_members
  for delete to authenticated using (
    public.is_trip_owner(trip_id)
  );

drop policy if exists trip_invitations_select_allowed on public.trip_invitations;
create policy trip_invitations_select_allowed on public.trip_invitations
  for select to authenticated using (
    invited_user_id = (select auth.uid())
    or public.is_trip_owner(trip_id)
  );
drop policy if exists trip_invitations_insert_owner on public.trip_invitations;
create policy trip_invitations_insert_owner on public.trip_invitations
  for insert to authenticated with check (
    invited_by = (select auth.uid())
    and public.is_trip_owner(trip_id)
  );
drop policy if exists trip_invitations_update_owner on public.trip_invitations;
create policy trip_invitations_update_owner on public.trip_invitations
  for update to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));
drop policy if exists trip_invitations_delete_owner on public.trip_invitations;
create policy trip_invitations_delete_owner on public.trip_invitations
  for delete to authenticated using (
    public.is_trip_owner(trip_id)
  );

-- El propietario es trips.user_id; no se crea una membresia duplicada.
drop policy if exists trips_select_own on public.trips;
create policy trips_select_own on public.trips
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.trip_members as member
      where member.trip_id = trips.id and member.user_id = (select auth.uid())
    )
  );
drop policy if exists trips_insert_own on public.trips;
create policy trips_insert_own on public.trips
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists trips_update_own on public.trips;
create policy trips_update_own on public.trips
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.trip_members as member
      where member.trip_id = trips.id and member.user_id = (select auth.uid()) and member.role = 'editor')
  )
  with check (
    user_id = (select auth.uid())
    or exists (select 1 from public.trip_members as member
      where member.trip_id = trips.id and member.user_id = (select auth.uid()) and member.role = 'editor')
  );
drop policy if exists trips_delete_own on public.trips;
create policy trips_delete_own on public.trips
  for delete to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.trip_members as member
      where member.trip_id = trips.id and member.user_id = (select auth.uid()) and member.role = 'editor')
  );

-- El editor puede cambiar metadatos del viaje, pero nadie transfiere ownership.
create or replace function public.prevent_trip_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'trip owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger if exists prevent_trip_owner_change on public.trips;
create trigger prevent_trip_owner_change
  before update of user_id on public.trips
  for each row execute function public.prevent_trip_owner_change();

-- Datos globales opcionales conservan privacidad del creador cuando trip_id es NULL.
do $$
declare
  t text;
begin
  foreach t in array array['expenses', 'notes', 'bookings', 'itinerary_activities', 'budgets']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format($policy$
      create policy %I on public.%I for select to authenticated using (
        (trip_id is null and user_id = (select auth.uid()))
        or (trip_id is not null and exists (
          select 1 from public.trips as parent_trip
          where parent_trip.id = trip_id and (
            parent_trip.user_id = (select auth.uid())
            or exists (select 1 from public.trip_members as member
              where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()))
          )
        ))
      )
    $policy$, t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format($policy$
      create policy %I on public.%I for insert to authenticated with check (
        (trip_id is null and user_id = (select auth.uid()))
        or (trip_id is not null and exists (
          select 1 from public.trips as parent_trip
          where parent_trip.id = trip_id and (
            parent_trip.user_id = (select auth.uid())
            or exists (select 1 from public.trip_members as member
              where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
          )
        ))
      )
    $policy$, t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format($policy$
      create policy %I on public.%I for update to authenticated
      using (
        (trip_id is null and user_id = (select auth.uid()))
        or (trip_id is not null and exists (
          select 1 from public.trips as parent_trip
          where parent_trip.id = trip_id and (
            parent_trip.user_id = (select auth.uid())
            or exists (select 1 from public.trip_members as member
              where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
          )
        ))
      )
      with check (
        (trip_id is null and user_id = (select auth.uid()))
        or (trip_id is not null and exists (
          select 1 from public.trips as parent_trip
          where parent_trip.id = trip_id and (
            parent_trip.user_id = (select auth.uid())
            or exists (select 1 from public.trip_members as member
              where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
          )
        ))
      )
    $policy$, t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format($policy$
      create policy %I on public.%I for delete to authenticated using (
        (trip_id is null and user_id = (select auth.uid()))
        or (trip_id is not null and exists (
          select 1 from public.trips as parent_trip
          where parent_trip.id = trip_id and (
            parent_trip.user_id = (select auth.uid())
            or exists (select 1 from public.trip_members as member
              where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
          )
        ))
      )
    $policy$, t || '_delete_own', t);
  end loop;
end $$;

-- Alerts siguen siendo privadas de su creador, aunque se enlacen a un viaje.
drop policy if exists alerts_select_own on public.alerts;
create policy alerts_select_own on public.alerts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists alerts_insert_own on public.alerts;
create policy alerts_insert_own on public.alerts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (trip_id is null or exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()))
      )
    ))
  );
drop policy if exists alerts_update_own on public.alerts;
create policy alerts_update_own on public.alerts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (trip_id is null or exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()))
      )
    ))
  );
drop policy if exists alerts_delete_own on public.alerts;
create policy alerts_delete_own on public.alerts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- tasks.trip_id NULL mantiene las tareas globales privadas del usuario.
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select to authenticated using (
    (trip_id is null and user_id = (select auth.uid()))
    or (trip_id is not null and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()))
      )
    ))
  );
drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check (
    (trip_id is null and user_id = (select auth.uid()))
    or (trip_id is not null and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
      )
    ))
  );
drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update to authenticated
  using (
    (trip_id is null and user_id = (select auth.uid()))
    or (trip_id is not null and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
      )
    ))
  )
  with check (
    (trip_id is null and user_id = (select auth.uid()))
    or (trip_id is not null and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
      )
    ))
  );
drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete to authenticated using (
    (trip_id is null and user_id = (select auth.uid()))
    or (trip_id is not null and exists (
      select 1 from public.trips as parent_trip
      where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
      )
    ))
  );

-- Diario: siempre ligado a un viaje, sin semantica de fila global.
do $$
declare
  t text;
begin
  foreach t in array array['journal_entries', 'journal_photos']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format($policy$
      create policy %I on public.%I for select to authenticated using (
        exists (select 1 from public.trips as parent_trip where parent_trip.id = trip_id and (
          parent_trip.user_id = (select auth.uid())
          or exists (select 1 from public.trip_members as member
            where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()))
        ))
      )
    $policy$, t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format($policy$
      create policy %I on public.%I for insert to authenticated with check (
        exists (select 1 from public.trips as parent_trip where parent_trip.id = trip_id and (
          parent_trip.user_id = (select auth.uid())
          or exists (select 1 from public.trip_members as member
            where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
        ))
      )
    $policy$, t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format($policy$
      create policy %I on public.%I for update to authenticated
      using (exists (select 1 from public.trips as parent_trip where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
      )))
      with check (exists (select 1 from public.trips as parent_trip where parent_trip.id = trip_id and (
        parent_trip.user_id = (select auth.uid())
        or exists (select 1 from public.trip_members as member
          where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
      )))
    $policy$, t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format($policy$
      create policy %I on public.%I for delete to authenticated using (
        exists (select 1 from public.trips as parent_trip where parent_trip.id = trip_id and (
          parent_trip.user_id = (select auth.uid())
          or exists (select 1 from public.trip_members as member
            where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
        ))
      )
    $policy$, t || '_delete_own', t);
  end loop;
end $$;

grant select, insert, update, delete on public.tasks to authenticated;

-- Storage requiere cruzar la key del objeto con journal_photos.key para seguir
-- la membresia efectiva del viaje. Verificado contra el backend real: la tabla
-- `storage.objects` de InsForge es (bucket, key, size, mime_type, uploaded_at,
-- uploaded_by, uploaded_via, s3_access_key_id, etag), no el esquema de Supabase.
-- El flujo actual sube el objeto antes de insertar journal_photos; esta policy
-- exige metadata previa. La subida de colaboradores necesita preparar esa fila
-- antes del objeto, tambien pendiente de validar en la fase de UI.
-- `storage.objects` en InsForge usa `bucket` y `key` (no `bucket_id`/`name`).
-- La comparacion con la fila del objeto (`key in (...)`) queda FUERA del
-- subselect a proposito: dentro, un `key` sin cualificar resolveria a
-- `photo.key` y la condicion seria siempre cierta.
drop policy if exists storage_objects_owner_select on storage.objects;
drop policy if exists storage_objects_owner_insert on storage.objects;
drop policy if exists storage_objects_owner_update on storage.objects;
drop policy if exists storage_objects_owner_delete on storage.objects;

create policy storage_objects_owner_select on storage.objects
  for select to authenticated using (
    (bucket <> 'journal-photos' and uploaded_by = (select auth.jwt() ->> 'sub'))
    or (bucket = 'journal-photos' and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()))
    ))
  );

create policy storage_objects_owner_insert on storage.objects
  for insert to authenticated with check (
    (bucket <> 'journal-photos' and uploaded_by = (select auth.jwt() ->> 'sub'))
    or (bucket = 'journal-photos' and uploaded_by = (select auth.jwt() ->> 'sub') and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
    ))
  );

create policy storage_objects_owner_update on storage.objects
  for update to authenticated
  using (
    (bucket <> 'journal-photos' and uploaded_by = (select auth.jwt() ->> 'sub'))
    or (bucket = 'journal-photos' and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
    ))
  )
  with check (
    (bucket <> 'journal-photos' and uploaded_by = (select auth.jwt() ->> 'sub'))
    or (bucket = 'journal-photos' and uploaded_by = (select auth.jwt() ->> 'sub') and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
    ))
  );

create policy storage_objects_owner_delete on storage.objects
  for delete to authenticated using (
    (bucket <> 'journal-photos' and uploaded_by = (select auth.jwt() ->> 'sub'))
    or (bucket = 'journal-photos' and key in (
      select photo.key from public.journal_photos as photo
      join public.trips as parent_trip on parent_trip.id = photo.trip_id
      where parent_trip.user_id = (select auth.uid())
         or exists (select 1 from public.trip_members as member
           where member.trip_id = parent_trip.id and member.user_id = (select auth.uid()) and member.role = 'editor')
    ))
  );

grant select, insert, update, delete on storage.objects to authenticated;
grant usage on schema storage to authenticated;
