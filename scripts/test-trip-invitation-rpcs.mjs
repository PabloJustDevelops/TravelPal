import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const migrationPath = fileURLToPath(new URL('../migrations/20261026140000_trip-invitation-rpcs.sql', import.meta.url))
const migration = await readFile(migrationPath, 'utf8')
const db = new PGlite()
const owner = '10000000-0000-4000-8000-000000000001'
const invitee = '20000000-0000-4000-8000-000000000002'
const secondInvitee = '30000000-0000-4000-8000-000000000003'
const trip = '40000000-0000-4000-8000-000000000004'

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role project_admin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text not null);
    insert into auth.users values
      ('${owner}', 'owner@example.com'),
      ('${invitee}', 'invitee@example.com'),
      ('${secondInvitee}', 'second@example.com');
    create table public.trips (id uuid primary key, user_id uuid not null references auth.users(id), title text not null);
    create table public.trip_members (
      id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('editor', 'reader')),
      created_at timestamptz not null default now(), unique (trip_id, user_id)
    );
    create table public.trip_invitations (
      id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
      invited_user_id uuid not null references auth.users(id) on delete cascade,
      invited_by uuid not null references auth.users(id) on delete cascade,
      role text not null check (role in ('editor', 'reader')),
      state text not null default 'pending' check (state in ('pending', 'accepted', 'rejected', 'revoked')),
      created_at timestamptz not null default now(), check (invited_user_id <> invited_by)
    );
    create unique index idx_trip_invitations_pending_unique on public.trip_invitations(trip_id, invited_user_id) where state = 'pending';
    insert into public.trips values ('${trip}', '${owner}', 'Trip title');
    grant usage on schema public to project_admin;
  `)
  await db.exec(migration)
  await db.exec(migration)

  const { rows: found } = await db.query("select * from public.find_trip_invitee($1)", [' INVITEE@example.com '])
  assert.deepEqual(found, [{ user_id: invitee }])
  const { rows: missing } = await db.query("select * from public.find_trip_invitee($1)", ['missing@example.com'])
  assert.deepEqual(missing, [])

  await db.query('insert into public.trip_invitations (trip_id, invited_user_id, invited_by, role) values ($1, $2, $3, $4)', [trip, invitee, owner, 'reader'])
  const firstInvite = (await db.query('select id from public.trip_invitations where invited_user_id = $1', [invitee])).rows[0].id
  await assert.rejects(db.query("update public.trip_invitations set state = 'accepted' where id = $1", [firstInvite]))
  const { rows: stillPendingAfterDirectUpdate } = await db.query('select state from public.trip_invitations where id = $1', [firstInvite])
  assert.deepEqual(stillPendingAfterDirectUpdate, [{ state: 'pending' }])
  const { rows: rpcData } = await db.query("select public.respond_trip_invitation($1, $2, 'accept') as state", [firstInvite, invitee])
  assert.equal(rpcData[0].state, 'accept')
  const { rows: accepted } = await db.query('select state from public.trip_invitations where invited_user_id = $1', [invitee])
  const { rows: member } = await db.query('select role from public.trip_members where user_id = $1', [invitee])
  assert.deepEqual(accepted, [{ state: 'accepted' }])
  assert.deepEqual(member, [{ role: 'reader' }])

  const { rows: invited } = await db.query('select public.create_trip_invitation($1, $2, $3, $4) as inserted', [trip, secondInvitee, owner, 'editor'])
  assert.equal(invited[0].inserted, true)
  const { rows: overview } = await db.query('select public.list_trip_collaboration($1, $2) as result', [trip, owner])
  assert.deepEqual(overview[0].result.members.map((row) => row.email), ['invitee@example.com'])
  const { rows: inbox } = await db.query('select * from public.list_my_trip_invitations($1)', [secondInvitee])
  assert.deepEqual(inbox.map((row) => row.trip_title), ['Trip title'])
  await db.exec(`create function public.reject_membership() returns trigger language plpgsql as $$ begin raise exception 'insertion denied'; end $$;
    create trigger reject_membership before insert on public.trip_members for each row when (new.user_id = '${secondInvitee}') execute function public.reject_membership();`)
  const failedInvite = (await db.query('select id from public.trip_invitations where invited_user_id = $1', [secondInvitee])).rows[0].id
  await assert.rejects(db.query("select public.respond_trip_invitation($1, $2, 'accept')", [failedInvite, secondInvitee]))
  const { rows: stillPending } = await db.query('select state from public.trip_invitations where id = $1', [failedInvite])
  assert.deepEqual(stillPending, [{ state: 'pending' }])

  console.log('Trip invitation RPCs: idempotency, private lookup/inbox, acceptance guard, membership, and atomic rollback passed')
} finally {
  await db.close()
}
