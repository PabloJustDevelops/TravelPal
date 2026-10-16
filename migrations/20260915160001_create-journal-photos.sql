-- Fotos del diario de viaje (hito 2 del issue #46).
--
-- Cada foto guarda SIEMPRE url y key: la url sirve para pintarla y la key es
-- lo que hace falta para borrar el objeto del bucket. RLS de propietario por
-- auth.uid() = user_id, como el resto del esquema
-- (ver migrations/20260913181842_create-app-schema.sql).
--
-- El bucket `journal-photos` se configura como privado (ADR-011). Su visibilidad
-- se administra en InsForge, no en esta migracion SQL. Las fotos se sirven con
-- URLs firmadas; la RLS de esta tabla limita los metadatos al propietario.
--
-- Idempotente: se puede aplicar mas de una vez sin romper.

create table if not exists public.journal_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  url text not null,
  key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_photos_user_id on public.journal_photos (user_id);
create index if not exists idx_journal_photos_trip_id on public.journal_photos (trip_id);

-- updated_at automatico (misma funcion built-in que usa el resto del esquema).
drop trigger if exists set_journal_photos_updated_at on public.journal_photos;
create trigger set_journal_photos_updated_at
  before update on public.journal_photos
  for each row execute function system.update_updated_at();

-- RLS de propietario: las cuatro politicas de siempre, por fila.
alter table public.journal_photos enable row level security;

drop policy if exists journal_photos_select_own on public.journal_photos;
create policy journal_photos_select_own on public.journal_photos
  for select using (auth.uid() = user_id);

drop policy if exists journal_photos_insert_own on public.journal_photos;
create policy journal_photos_insert_own on public.journal_photos
  for insert with check (auth.uid() = user_id);

drop policy if exists journal_photos_update_own on public.journal_photos;
create policy journal_photos_update_own on public.journal_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists journal_photos_delete_own on public.journal_photos;
create policy journal_photos_delete_own on public.journal_photos
  for delete using (auth.uid() = user_id);

-- La migracion base concedio privilegios solo a las tablas que existian
-- entonces, asi que una tabla nueva necesita su grant explicito.
grant select, insert, update, delete on public.journal_photos to anon, authenticated;
