-- Esquema de la app derivado de las consultas reales (rutas API + paginas + src/lib).
-- text + CHECK en vez de enums; las uniones de strings del TS son la fuente de verdad.
-- Ejecutar como migracion de InsForge (project_admin) en el esquema public.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- users: la usa ensureUserExists() (insert/select por id)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles: getCurrentUser()/updateProfile() en src/lib/auth.ts
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  website text,
  bio text,
  phone text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trips: /api/trips, /api/budget, /api/analytics, /api/dashboard, planning, trips/[id]
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  origin text not null,
  destination text not null,
  departure_date timestamptz not null,
  return_date timestamptz,
  airline text,
  flight_number text,
  confirmation_number text,
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- expenses: /api/expenses(+/[id]), /api/budget, /api/analytics, /api/dashboard
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  title text not null,
  amount numeric not null,
  currency text not null default 'EUR',
  category text not null,
  date timestamptz not null,
  description text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- notes: /api/notes, notes page y notes/[id] (select `*, trip:trips(*)`)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  category text not null default 'general',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tasks: /api/tasks(+/[id])
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- bookings: /api/planning (GET/POST/PUT), planning page, insforge-functions
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  type text not null
    check (type in ('flight', 'hotel', 'car', 'activity', 'restaurant', 'other')),
  title text not null,
  description text,
  confirmation_number text,
  status text not null default 'pending'
    check (status in ('confirmed', 'pending', 'cancelled')),
  start_date date not null,
  end_date date,
  start_time time,
  end_time time,
  location text,
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  cost numeric default 0,
  currency text not null default 'EUR',
  notes text,
  documents jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- itinerary_activities: /api/planning, planning page, insforge-functions
create table if not exists public.itinerary_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  date date not null,
  title text not null,
  description text,
  start_time time,
  end_time time,
  location text,
  address text,
  category text not null default 'general',
  cost numeric,
  currency text not null default 'EUR',
  notes text,
  completed boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tablas retiradas: reminders y calendar_events
--
-- Se quitaron de este esquema porque nunca existieron en el backend de
-- InsForge: nadie las escribia ni las leia (ver
-- docs/audits/auditoria-utilidad-y-rework.md). El backend actual no las tiene,
-- asi que sus definiciones de tabla, indices, triggers de updated_at y RLS se
-- eliminaron de esta migracion. En un backend nuevo no deben volver a crearse.
-- ---------------------------------------------------------------------------

-- alerts: alerts page y NotificationSystem
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  title text not null,
  message text not null,
  alert_date timestamptz,
  is_read boolean not null default false,
  type text not null default 'info'
    check (type in ('reminder', 'warning', 'info')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- budgets: /api/budget(+/[id]), /api/analytics, /api/dashboard, budget page
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  name text not null,
  total_amount numeric not null,
  spent_amount numeric not null default 0,
  currency text not null default 'USD',
  category text not null,
  start_date date not null,
  end_date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indices (solo los que salen de filtros/ordenes reales)
-- ---------------------------------------------------------------------------
create index if not exists idx_trips_user_id on public.trips (user_id);
create index if not exists idx_trips_departure_date on public.trips (departure_date);
create index if not exists idx_trips_created_at on public.trips (created_at);

create index if not exists idx_expenses_user_id on public.expenses (user_id);
create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_expenses_trip_id on public.expenses (trip_id);

create index if not exists idx_notes_user_id on public.notes (user_id);
create index if not exists idx_notes_updated_at on public.notes (updated_at);
create index if not exists idx_notes_trip_id on public.notes (trip_id);

create index if not exists idx_tasks_user_id on public.tasks (user_id);
create index if not exists idx_tasks_created_at on public.tasks (created_at);

create index if not exists idx_bookings_user_id on public.bookings (user_id);
create index if not exists idx_bookings_start_date on public.bookings (start_date);
create index if not exists idx_bookings_trip_id on public.bookings (trip_id);

create index if not exists idx_itinerary_activities_user_id on public.itinerary_activities (user_id);
create index if not exists idx_itinerary_activities_trip_id on public.itinerary_activities (trip_id);
create index if not exists idx_itinerary_activities_date on public.itinerary_activities (date);

create index if not exists idx_alerts_user_id on public.alerts (user_id);
create index if not exists idx_alerts_created_at on public.alerts (created_at);

create index if not exists idx_budgets_user_id on public.budgets (user_id);
create index if not exists idx_budgets_created_at on public.budgets (created_at);

-- ---------------------------------------------------------------------------
-- updated_at automatico (funcion built-in de InsForge)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'profiles', 'trips', 'expenses', 'notes', 'tasks', 'bookings',
    'itinerary_activities', 'alerts', 'budgets'
  ]
  loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$s', t);
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$s for each row execute function system.update_updated_at()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.expenses enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.bookings enable row level security;
alter table public.itinerary_activities enable row level security;
alter table public.alerts enable row level security;
alter table public.budgets enable row level security;

-- Tablas con user_id: politicas de propietario
do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'expenses', 'notes', 'tasks', 'bookings',
    'itinerary_activities', 'alerts', 'budgets'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- users y profiles: la propiedad va por `id`
do $$
declare
  t text;
begin
  foreach t in array array['users', 'profiles']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = id)', t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = id)', t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = id) with check (auth.uid() = id)', t || '_update_own', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Privilegios para los roles de runtime (PostgREST); RLS decide las filas
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
