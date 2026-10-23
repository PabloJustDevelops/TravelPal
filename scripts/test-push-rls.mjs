import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../migrations/20261023120000_browser-push-server.sql', import.meta.url), 'utf8')
const db = new PGlite()
const owner = '10000000-0000-4000-8000-000000000001'
const other = '20000000-0000-4000-8000-000000000002'
const fairOwner = '30000000-0000-4000-8000-000000000005'
const claim = '30000000-0000-4000-8000-000000000001'
const secondClaim = '30000000-0000-4000-8000-000000000002'
const fairnessClaim = '30000000-0000-4000-8000-000000000003'
const fairnessRetryClaim = '30000000-0000-4000-8000-000000000004'
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role project_admin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}'), ('${fairOwner}');
    create table public.alerts (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
      title text not null default 'Alert', message text not null default 'Message', trip_id uuid,
      alert_date timestamptz, created_at timestamptz not null default now(),
      is_read boolean not null default false
    );
  `)
  await db.transaction(async (tx) => { await tx.exec(migration) })
  await db.transaction(async (tx) => { await tx.exec(migration) })
  const index = await db.query("select indexdef from pg_indexes where indexname = 'idx_alerts_push_pending'")
  assert.match(index.rows[0].indexdef, /WHERE \(push_sent_at IS NULL\)/)
  assert.match(index.rows[0].indexdef, /push_claimed_at NULLS FIRST/)
  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner])
  await db.query('insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)', [owner, 'https://fcm.googleapis.com/owner', 'key', 'auth'])
  await assert.rejects(db.query('insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)', [other, 'https://fcm.googleapis.com/other', 'key', 'auth']), { code: '42501' })
  await assert.rejects(db.query('update public.push_subscriptions set user_id = $1', [other]), { code: '42501' })
  assert.equal((await db.query("update public.push_subscriptions set user_agent = 'test' returning id")).rows.length, 1)
  assert.equal((await db.query('delete from public.push_subscriptions returning id')).rows.length, 1)
  await db.query('insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)', [owner, 'https://fcm.googleapis.com/owner', 'key', 'auth'])
  await assert.rejects(db.query('select * from public.claim_push_alerts($1, 10)', [claim]), { code: '42501' })
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other])
  assert.equal((await db.query('select * from public.push_subscriptions')).rows.length, 0)
  assert.equal((await db.query("update public.push_subscriptions set auth = 'evil' returning id")).rows.length, 0)
  assert.equal((await db.query('delete from public.push_subscriptions returning id')).rows.length, 0)
  await db.exec('reset role; set role anon')
  await assert.rejects(db.query('select * from public.push_subscriptions'), { code: '42501' })
  await assert.rejects(db.query('select * from public.claim_push_alerts($1, 10)', [claim]), { code: '42501' })
  await db.exec('reset role')
  await db.query(`insert into public.alerts (user_id, alert_date)
    select $1, now() - interval '2 hours' - (n * interval '1 second')
    from generate_series(1, 10) as n`, [owner])
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ($1, $2, 'key', 'auth')`, [fairOwner, 'https://fcm.googleapis.com/fair-user'])
  const laterAlert = await db.query(`insert into public.alerts (user_id, alert_date)
    values ($1, now() - interval '1 minute') returning id`, [fairOwner])
  await db.exec('set role project_admin')
  const fairnessFirst = await db.query('select * from public.claim_push_alerts($1, 10)', [fairnessClaim])
  assert.equal(fairnessFirst.rows.length, 10)
  assert.equal(fairnessFirst.rows.some(a => a.id === laterAlert.rows[0].id), false)
  const failedIds = fairnessFirst.rows.map(a => a.id)
  // Model finish(..., null): clear only the token and keep the last-claim timestamp for rotation.
  await db.query(`update public.alerts set push_sent_at = null, push_claim_token = null
    where id = any($1::uuid[]) and push_claim_token = $2`, [failedIds, fairnessClaim])
  await db.query(`update public.alerts set push_claimed_at = now() - interval '6 minutes'
    where id = any($1::uuid[])`, [failedIds])
  const fairnessRetry = await db.query('select * from public.claim_push_alerts($1, 10)', [fairnessRetryClaim])
  assert.equal(
    fairnessRetry.rows.some(a => a.id === laterAlert.rows[0].id),
    true,
    'ten repeatedly failing older alerts must not block a newer alert after lease expiry',
  )
  await db.exec('reset role')
  await db.query('delete from public.alerts where id = any($1::uuid[])', [[...failedIds, laterAlert.rows[0].id]])
  await db.query('delete from public.push_subscriptions where user_id = $1', [fairOwner])
  await db.query(`insert into public.alerts (user_id, alert_date)
    select $1, now() - interval '1 minute' from generate_series(1, 12)`, [owner])
  await db.query(`insert into public.alerts (user_id, alert_date) values
    ($1, now() + interval '1 minute'), ($1, now() - interval '25 hours'), ($2, now())`, [owner, other])
  await db.query("insert into public.alerts (user_id, is_read) values ($1, true)", [owner])
  await db.query("insert into public.alerts (user_id, push_sent_at) values ($1, now())", [owner])
  await db.query("insert into public.alerts (user_id, alert_date) values ($1, null)", [owner])
  await db.exec('set role project_admin')
  const first = await db.query('select * from public.claim_push_alerts($1, 9999)', [claim])
  assert.equal(first.rows.length, 10, 'SQL must cap the batch even with a huge caller-supplied limit')
  const second = await db.query('select * from public.claim_push_alerts($1, 10)', [secondClaim])
  assert.equal(second.rows.length, 3, 'active leases must exclude the first batch, with null dates due at creation')
  assert.equal(first.rows.some(a => second.rows.some(b => b.id === a.id)), false)
  await db.query('update public.alerts set push_sent_at = now(), push_claimed_at = null, push_claim_token = null where id = $1', [first.rows[0].id])
  await db.query("update public.alerts set push_claimed_at = now() - interval '6 minutes' where push_sent_at is null and push_claim_token = $1", [claim])
  const retry = await db.query('select * from public.claim_push_alerts($1, 10)', [secondClaim])
  assert.equal(retry.rows.length, 9, 'expired leases must retry, while sent alerts never do')
  assert.equal(retry.rows.some(a => a.id === first.rows[0].id), false)
  await db.exec('reset role')
  await db.query('delete from public.alerts where user_id = $1', [other])
  await db.query('delete from auth.users where id = $1', [other])
  await db.query("delete from public.alerts where user_id = $1", [owner])
  await db.query('delete from auth.users where id = $1', [owner])
  assert.equal((await db.query('select * from public.push_subscriptions')).rows.length, 0, 'subscriptions cascade on account deletion')
  console.log('Push migration: idempotency, owner CRUD RLS, RPC privileges, bounded leases, due window and deduplication passed')
} finally {
  await db.close()
}
