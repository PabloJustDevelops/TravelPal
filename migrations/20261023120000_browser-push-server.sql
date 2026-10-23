-- Mitad servidor de Web Push (#48). Idempotente; no modifica migraciones aplicadas.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated, project_admin;

alter table public.alerts add column if not exists push_sent_at timestamptz;
-- Una reserva recuperable evita que invocaciones solapadas seleccionen la misma alerta.
alter table public.alerts add column if not exists push_claimed_at timestamptz;
alter table public.alerts add column if not exists push_claim_token uuid;
create index if not exists idx_alerts_push_pending on public.alerts
  (push_claimed_at asc nulls first, (coalesce(alert_date, created_at)), id)
  where push_sent_at is null;
grant select, update on public.alerts to project_admin;

-- SECURITY INVOKER: solo project_admin (API_KEY) tiene EXECUTE, sin elevar a un usuario.
-- La fuente sigue siendo alerts persistida por la campana, no genera alertas nuevas.
create or replace function public.claim_push_alerts(claim_token uuid, batch_size integer default 10)
returns setof public.alerts
language sql volatile security invoker set search_path = pg_catalog, public
as $$
  with pending as (
    select a.id from public.alerts a
    where a.push_sent_at is null and not a.is_read
      and coalesce(a.alert_date, a.created_at) between now() - interval '24 hours' and now()
      and (a.push_claimed_at is null or a.push_claimed_at < now() - interval '5 minutes')
      and exists (select 1 from public.push_subscriptions s where s.user_id = a.user_id)
    order by a.push_claimed_at asc nulls first, coalesce(a.alert_date, a.created_at), a.id
    limit greatest(1, least(coalesce(batch_size, 10), 10))
    for update of a skip locked
  )
  update public.alerts a set push_claimed_at = now(), push_claim_token = claim_token
  from pending p where a.id = p.id returning a.*;
$$;
revoke all on function public.claim_push_alerts(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_push_alerts(uuid, integer) to project_admin;
