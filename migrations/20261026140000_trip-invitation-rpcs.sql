-- RPC internas para el ciclo de invitaciones. Solo project_admin puede invocarlas.
-- La respuesta y la membresía se confirman en una única transacción PostgreSQL.

grant select on public.trips to project_admin;
grant select, insert, update on public.trip_invitations to project_admin;
grant select, insert on public.trip_members to project_admin;
grant usage on schema auth to project_admin;
grant select (id, email) on auth.users to project_admin;

-- La política de fase 1 permite al dueño modificar invitaciones desde el SDK.
-- Impide que cualquier ruta marque accepted sin membresía ya persistida.
create or replace function public.prevent_trip_invitation_acceptance_without_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.state = 'accepted' and not exists (
    select 1 from public.trip_members m
    where m.trip_id = new.trip_id and m.user_id = new.invited_user_id
  ) then
    raise exception 'invitation acceptance requires membership' using errcode = '42501';
  end if;
  return new;
end
$$;
revoke all on function public.prevent_trip_invitation_acceptance_without_membership() from public, anon, authenticated;
drop trigger if exists trip_invitation_acceptance_requires_membership on public.trip_invitations;
create trigger trip_invitation_acceptance_requires_membership
  before insert or update on public.trip_invitations
  for each row execute function public.prevent_trip_invitation_acceptance_without_membership();

create or replace function public.find_trip_invitee(requested_email text)
returns table (user_id uuid)
language sql stable security invoker set search_path = pg_catalog, auth
as $$
  select u.id
  from auth.users as u
  where lower(u.email) = lower(trim(requested_email))
  limit 1
$$;
revoke all on function public.find_trip_invitee(text) from public, anon, authenticated;
grant execute on function public.find_trip_invitee(text) to project_admin;

create or replace function public.create_trip_invitation(
  target_trip_id uuid,
  target_user_id uuid,
  actor_id uuid,
  invitation_role text
)
returns boolean
language plpgsql volatile security invoker set search_path = pg_catalog, public
as $$
begin
  if invitation_role not in ('editor', 'reader') then
    raise exception 'invalid invitation role';
  end if;
  if not exists (select 1 from public.trips t where t.id = target_trip_id and t.user_id = actor_id) then
    raise exception 'trip owner mismatch';
  end if;
  if target_user_id = actor_id then return false; end if;
  if exists (select 1 from public.trip_members m where m.trip_id = target_trip_id and m.user_id = target_user_id) then
    return false;
  end if;
  insert into public.trip_invitations (trip_id, invited_user_id, invited_by, role)
  values (target_trip_id, target_user_id, actor_id, invitation_role)
  on conflict (trip_id, invited_user_id) where state = 'pending' do nothing;
  return true;
end
$$;
revoke all on function public.create_trip_invitation(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_trip_invitation(uuid, uuid, uuid, text) to project_admin;

create or replace function public.list_trip_collaboration(target_trip_id uuid, actor_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public, auth
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.trips t where t.id = target_trip_id and t.user_id = actor_id) then
    raise exception 'trip owner mismatch';
  end if;
  select jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('trip_id', m.trip_id, 'user_id', m.user_id, 'email', u.email, 'role', m.role, 'created_at', m.created_at) order by u.email)
      from public.trip_members m join auth.users u on u.id = m.user_id where m.trip_id = target_trip_id
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', u.email, 'role', i.role, 'state', i.state, 'created_at', i.created_at) order by i.created_at desc)
      from public.trip_invitations i join auth.users u on u.id = i.invited_user_id
      where i.trip_id = target_trip_id and i.state = 'pending'
    ), '[]'::jsonb)
  ) into result;
  return result;
end
$$;
revoke all on function public.list_trip_collaboration(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_trip_collaboration(uuid, uuid) to project_admin;

create or replace function public.list_my_trip_invitations(actor_id uuid)
returns table (
  id uuid,
  trip_id uuid,
  trip_title text,
  role text,
  created_at timestamptz,
  invited_by_email text
)
language sql stable security invoker set search_path = pg_catalog, public, auth
as $$
  select i.id, i.trip_id, t.title, i.role, i.created_at, inviter.email
  from public.trip_invitations i
  join public.trips t on t.id = i.trip_id
  join auth.users inviter on inviter.id = i.invited_by
  where i.invited_user_id = actor_id and i.state = 'pending'
  order by i.created_at desc
$$;
revoke all on function public.list_my_trip_invitations(uuid) from public, anon, authenticated;
grant execute on function public.list_my_trip_invitations(uuid) to project_admin;

create or replace function public.respond_trip_invitation(
  target_invitation_id uuid,
  actor_id uuid,
  invitation_response text
)
returns text
language plpgsql volatile security invoker set search_path = pg_catalog, public
as $$
declare
  invitation public.trip_invitations%rowtype;
begin
  if invitation_response not in ('accept', 'reject') then raise exception 'invalid response'; end if;
  select * into invitation from public.trip_invitations i
    where i.id = target_invitation_id for update;
  if not found or invitation.invited_user_id <> actor_id or invitation.state <> 'pending' then
    raise exception 'invitation unavailable';
  end if;
  if invitation_response = 'accept' then
    insert into public.trip_members (trip_id, user_id, role)
    values (invitation.trip_id, actor_id, invitation.role)
    on conflict (trip_id, user_id) do nothing;
    update public.trip_invitations set state = 'accepted' where id = target_invitation_id;
    return 'accept';
  end if;
  update public.trip_invitations set state = 'rejected' where id = target_invitation_id;
  return 'reject';
end
$$;
revoke all on function public.respond_trip_invitation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.respond_trip_invitation(uuid, uuid, text) to project_admin;
