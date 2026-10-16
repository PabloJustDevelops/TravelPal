import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const migrationPath = fileURLToPath(
  new URL('../migrations/20261015120000_enforce-trip-owner-rls.sql', import.meta.url),
)
const migration = await readFile(migrationPath, 'utf8')
const userA = '10000000-0000-4000-8000-000000000001'
const userB = '20000000-0000-4000-8000-000000000002'
const tripA = '30000000-0000-4000-8000-000000000001'
const tripB = '40000000-0000-4000-8000-000000000002'
const optionalTables = [
  'expenses',
  'notes',
  'bookings',
  'itinerary_activities',
  'alerts',
  'budgets',
]
const requiredTables = ['journal_entries', 'journal_photos']
const tables = [...optionalTables, ...requiredTables]

const db = new PGlite()

try {
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;

    create table public.trips (id uuid primary key, user_id uuid not null);
    alter table public.trips enable row level security;
    create policy trips_select_own on public.trips
      for select to authenticated using ((select auth.uid()) = user_id);
    grant select on public.trips to authenticated;

    insert into public.trips values
      ('${tripA}', '${userA}'),
      ('${tripB}', '${userB}');
  `)

  for (const table of tables) {
    await db.exec(`
      create table public.${table} (id uuid primary key, user_id uuid not null, trip_id uuid);
      alter table public.${table} enable row level security;
      create policy ${table}_select_own on public.${table}
        for select to authenticated using ((select auth.uid()) = user_id);
      create policy ${table}_insert_own on public.${table}
        for insert to authenticated with check ((select auth.uid()) = user_id);
      create policy ${table}_update_own on public.${table}
        for update to authenticated using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id);
      grant select, insert, update on public.${table} to authenticated;
    `)
  }

  await db.exec(migration)

  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA])

  const visibleTrips = await db.query('select id from public.trips order by id')
  assert.deepEqual(visibleTrips.rows.map(({ id }) => id), [tripA])

  for (const table of tables) {
    const rowId = `50000000-0000-4000-8000-${String(tables.indexOf(table) + 1).padStart(12, '0')}`
    await db.query(`insert into public.${table} (id, user_id, trip_id) values ($1, $2, $3)`, [rowId, userA, tripA])

    await assert.rejects(
      db.query(`insert into public.${table} (id, user_id, trip_id) values ($1, $2, $3)`, [
        `60000000-0000-4000-8000-${String(tables.indexOf(table) + 1).padStart(12, '0')}`,
        userA,
        tripB,
      ]),
      { code: '42501' },
      `${table} must reject a row linked to another user's trip`,
    )

    const ownTripUpdate = await db.query(
      `update public.${table} set trip_id = $1 where id = $2 returning id`,
      [tripA, rowId],
    )
    assert.equal(ownTripUpdate.rows.length, 1, `${table} must allow updating to its owner's trip`)
    await assert.rejects(
      db.query(`update public.${table} set trip_id = $1 where id = $2`, [tripB, rowId]),
      { code: '42501' },
      `${table} must reject updating a row to another user's trip`,
    )

    const nullRowId = `70000000-0000-4000-8000-${String(tables.indexOf(table) + 1).padStart(12, '0')}`
    if (optionalTables.includes(table)) {
      await db.query(`insert into public.${table} (id, user_id, trip_id) values ($1, $2, null)`, [nullRowId, userA])
      const setTrip = await db.query(
        `update public.${table} set trip_id = $1 where id = $2 returning id`,
        [tripA, nullRowId],
      )
      assert.equal(setTrip.rows.length, 1, `${table} must allow an optional trip to be set`)
      const clearTrip = await db.query(
        `update public.${table} set trip_id = null where id = $1 returning id`,
        [nullRowId],
      )
      assert.equal(clearTrip.rows.length, 1, `${table} must allow clearing an optional trip`)
    } else {
      await assert.rejects(
        db.query(`insert into public.${table} (id, user_id, trip_id) values ($1, $2, null)`, [nullRowId, userA]),
        { code: '42501' },
        `${table} must require a trip on insert`,
      )
      await assert.rejects(
        db.query(`update public.${table} set trip_id = null where id = $1`, [rowId]),
        { code: '42501' },
        `${table} must require a trip on update`,
      )
    }
  }

  console.log('RLS trip_id behavior passed')
} finally {
  await db.close()
}
