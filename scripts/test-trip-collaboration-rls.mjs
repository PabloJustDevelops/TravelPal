import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const migrationPath = fileURLToPath(
  new URL('../migrations/20261026120000_trip-collaboration-rls.sql', import.meta.url),
)
const migration = await readFile(migrationPath, 'utf8')
const owner = '10000000-0000-4000-8000-000000000001'
const editor = '20000000-0000-4000-8000-000000000002'
const reader = '30000000-0000-4000-8000-000000000003'
const intruder = '40000000-0000-4000-8000-000000000004'
const trip = '50000000-0000-4000-8000-000000000001'
const otherTrip = '60000000-0000-4000-8000-000000000002'
const childTables = [
  'expenses',
  'notes',
  'bookings',
  'itinerary_activities',
  'budgets',
  'alerts',
  'journal_entries',
  'journal_photos',
  'tasks',
]
const db = new PGlite()

async function setUser(userId) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId])
}

async function expectDenied(promise, message) {
  await assert.rejects(promise, { code: '42501' }, message)
}

try {
  await db.exec(`
    create role authenticated;
    create schema auth;
    create schema storage;
    create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb
      language sql stable
      as $$ select jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true)) $$;
    grant usage on schema auth, storage to authenticated;
    grant execute on function auth.uid(), auth.jwt() to authenticated;

    create table auth.users (id uuid primary key);
    insert into auth.users values ('${owner}'), ('${editor}'), ('${reader}'), ('${intruder}');
    create table public.trips (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, title text);
    alter table public.trips enable row level security;
    create policy trips_select_own on public.trips for select to authenticated using ((select auth.uid()) = user_id);
    create policy trips_insert_own on public.trips for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy trips_update_own on public.trips for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy trips_delete_own on public.trips for delete to authenticated using ((select auth.uid()) = user_id);
    grant select, insert, update, delete on public.trips to authenticated;

    create table public.expenses (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid references public.trips(id) on delete set null, label text);
    create table public.notes (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid references public.trips(id) on delete set null, label text);
    create table public.bookings (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid references public.trips(id) on delete cascade, label text);
    create table public.itinerary_activities (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid references public.trips(id) on delete cascade, label text);
    create table public.budgets (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid references public.trips(id) on delete set null, label text);
    create table public.alerts (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid references public.trips(id) on delete set null, label text);
    create table public.journal_entries (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid not null references public.trips(id) on delete cascade, label text);
    create table public.journal_photos (id uuid primary key, user_id uuid not null references auth.users(id), trip_id uuid not null references public.trips(id) on delete cascade, key text not null, label text);
    create table public.tasks (id uuid primary key, user_id uuid not null references auth.users(id), label text);

    insert into public.trips values ('${trip}', '${owner}', 'Shared trip'), ('${otherTrip}', '${intruder}', 'Intruder trip');
  `)

  for (const table of childTables) {
    await db.exec(`
      alter table public.${table} enable row level security;
      create policy ${table}_select_own on public.${table} for select to authenticated using ((select auth.uid()) = user_id);
      create policy ${table}_insert_own on public.${table} for insert to authenticated with check ((select auth.uid()) = user_id);
      create policy ${table}_update_own on public.${table} for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
      create policy ${table}_delete_own on public.${table} for delete to authenticated using ((select auth.uid()) = user_id);
      grant select, insert, update, delete on public.${table} to authenticated;
    `)
  }

  await db.exec(`
    -- Esquema real de InsForge: storage.objects(bucket, key, uploaded_by).
    -- No es el de Supabase (bucket_id/name): si se copia ese, el test pasa y la
    -- migracion falla contra el backend con 'column "bucket_id" does not exist'.
    create table storage.objects (id uuid primary key, bucket text not null, key text not null, uploaded_by text);
    alter table storage.objects enable row level security;
    create policy storage_objects_owner_select on storage.objects for select to authenticated using (uploaded_by = (select auth.jwt() ->> 'sub'));
    create policy storage_objects_owner_insert on storage.objects for insert to authenticated with check (uploaded_by = (select auth.jwt() ->> 'sub'));
    create policy storage_objects_owner_update on storage.objects for update to authenticated using (uploaded_by = (select auth.jwt() ->> 'sub')) with check (uploaded_by = (select auth.jwt() ->> 'sub'));
    create policy storage_objects_owner_delete on storage.objects for delete to authenticated using (uploaded_by = (select auth.jwt() ->> 'sub'));
    grant select, insert, update, delete on storage.objects to authenticated;
  `)

  try {
    await db.exec(migration)
    await db.exec(migration)
  } catch (error) {
    console.error(error.message)
    throw error
  }
  console.log('Idempotencia de migración aplicada dos veces: OK')

  await db.exec('set role authenticated')
  await setUser(owner)
  const ownerTrips = await db.query('select id from public.trips order by id')
  assert.deepEqual(ownerTrips.rows.map(({ id }) => id), [trip])
  assert.equal((await db.query('update public.trips set title = $1 where id = $2 returning id', ['Owner edit', trip])).rows.length, 1)
  await expectDenied(
    db.query('update public.trips set user_id = $1 where id = $2', [reader, trip]),
    'trip ownership cannot be transferred in this phase',
  )
  console.log('Dueño: ve y actualiza su viaje: OK')

  await db.query('insert into public.trip_members (trip_id, user_id, role) values ($1, $2, $3), ($1, $4, $5)', [trip, editor, 'editor', reader, 'reader'])
  await db.query('insert into public.expenses (id, user_id, trip_id) values ($1, $2, $3)', ['70000000-0000-4000-8000-000000000001', owner, trip])

  await setUser(editor)
  assert.equal((await db.query('select id from public.trips')).rows.length, 1)
  assert.equal((await db.query('update public.trips set title = $1 where id = $2 returning id', ['Editor edit', trip])).rows.length, 1)
  let photoId
  for (const table of childTables) {
    const id = `80000000-0000-4000-8000-${String(childTables.indexOf(table) + 1).padStart(12, '0')}`
    if (table === 'tasks') {
      await db.query('insert into public.tasks (id, user_id, trip_id) values ($1, $2, $3)', [id, editor, trip])
    } else if (table === 'journal_photos') {
      await db.query('insert into public.journal_photos (id, user_id, trip_id, key) values ($1, $2, $3, $4)', [id, editor, trip, `photo-${id}`])
      photoId = id
      await db.query('insert into storage.objects (id, bucket, key, uploaded_by) values ($1, $2, $3, $4)', [
        '82000000-0000-4000-8000-000000000001', 'journal-photos', `photo-${id}`, editor,
      ])
    } else {
      await db.query(`insert into public.${table} (id, user_id, trip_id) values ($1, $2, $3)`, [id, editor, trip])
    }
    assert.equal((await db.query(`select id from public.${table} where id = $1`, [id])).rows.length, 1, `${table}: editor reads`)
    await db.query(`update public.${table} set label = $1 where id = $2`, ['editor updated', id])
  }
  const editorBudgetDeleteId = '83000000-0000-4000-8000-000000000001'
  await db.query('insert into public.budgets (id, user_id, trip_id, label) values ($1, $2, $3, $4)', [editorBudgetDeleteId, editor, trip, 'delete this'])
  assert.equal((await db.query('delete from public.budgets where id = $1 returning id', [editorBudgetDeleteId])).rows.length, 1)
  await expectDenied(
    db.query('insert into public.expenses (id, user_id, trip_id) values ($1, $2, $3)', ['81000000-0000-4000-8000-000000000001', editor, otherTrip]),
    'editor cannot attach a row to a foreign trip',
  )
  await expectDenied(
    db.query('update public.expenses set trip_id = $1 where id = $2', [otherTrip, '70000000-0000-4000-8000-000000000001']),
    'editor cannot reassign an existing row to a foreign trip',
  )
  console.log('Editor: lee, inserta, actualiza y borra en su viaje; reasignación ajena denegada: OK')

  await setUser(reader)
  assert.equal((await db.query('select id from public.trips')).rows.length, 1)
  assert.equal((await db.query('update public.trips set title = $1 where id = $2 returning id', ['Reader edit', trip])).rows.length, 0)
  assert.equal((await db.query('select id from public.expenses')).rows.length, 2)
  assert.equal((await db.query('select id from storage.objects where key = $1', [`photo-${photoId}`])).rows.length, 1)
  for (const table of childTables) {
    const visibleRows = await db.query(`select id from public.${table}`)
    const expectedRows = table === 'alerts' ? 0 : table === 'expenses' ? 2 : 1
    assert.equal(visibleRows.rows.length, expectedRows, `${table}: reader visibility follows trip membership; alerts remain private`)
  }
  await expectDenied(
    db.query('insert into public.expenses (id, user_id, trip_id) values ($1, $2, $3)', ['82000000-0000-4000-8000-000000000001', reader, trip]),
    'reader cannot insert trip rows',
  )
  assert.equal((await db.query('update public.expenses set user_id = $1 returning id', [reader])).rows.length, 0)
  assert.equal((await db.query('delete from public.expenses returning id')).rows.length, 0)
  assert.equal((await db.query('delete from storage.objects where key = $1 returning id', [`photo-${photoId}`])).rows.length, 0)
  console.log('Lector: solo lectura en viaje, filas hijas y foto de Storage: OK')

  await setUser(intruder)
  assert.equal((await db.query('select id from public.trips')).rows.length, 1)
  assert.equal((await db.query('select id from public.expenses')).rows.length, 0)
  for (const table of childTables) {
    assert.equal((await db.query(`select id from public.${table}`)).rows.length, 0, `${table}: intruder cannot read shared trip rows`)
  }
  console.log('Intruso: solo ve su viaje y no ve datos del viaje compartido: OK')

  const globalTask = '90000000-0000-4000-8000-000000000001'
  await setUser(owner)
  await db.query('insert into public.tasks (id, user_id) values ($1, $2)', [globalTask, owner])
  await setUser(intruder)
  await expectDenied(
    db.query('insert into public.tasks (id, user_id, trip_id) values ($1, $2, $3)', ['91000000-0000-4000-8000-000000000001', intruder, trip]),
    'intruder cannot reassign a task to a shared trip',
  )
  await setUser(editor)
  assert.equal((await db.query('select id from public.tasks where trip_id is null')).rows.length, 0)
  assert.equal((await db.query('update public.tasks set trip_id = $1 where id = $2 returning id', [trip, globalTask])).rows.length, 0)
  await setUser(owner)
  assert.equal((await db.query('select id from public.tasks where trip_id is null')).rows.length, 1)
  console.log('Tareas globales con trip_id nulo: privadas de user_id: OK')

  const editorDeleteTrip = '65000000-0000-4000-8000-000000000003'
  await db.query('insert into public.trips (id, user_id, title) values ($1, $2, $3)', [editorDeleteTrip, owner, 'Editor deletion test'])
  await db.query('insert into public.trip_members (trip_id, user_id, role) values ($1, $2, $3)', [editorDeleteTrip, editor, 'editor'])
  await setUser(editor)
  assert.equal((await db.query('delete from public.trips where id = $1 returning id', [editorDeleteTrip])).rows.length, 1)
  assert.equal((await db.query('select trip_id from public.trip_members where trip_id = $1', [editorDeleteTrip])).rows.length, 0)
  console.log('Editor: puede borrar un viaje y las membresías se eliminan en cascada: OK')

  await setUser(owner)
  await db.query('delete from public.trip_members where trip_id = $1 and user_id = $2', [trip, editor])
  await setUser(editor)
  assert.equal((await db.query('select id from public.trips')).rows.length, 0)
  assert.equal((await db.query('select id from public.expenses')).rows.length, 0)
  console.log('Revocación: quitar membresía deniega la siguiente consulta: OK')

  await setUser(owner)
  await db.query('delete from public.trips where id = $1', [trip])
  assert.equal((await db.query('select trip_id from public.trip_members')).rows.length, 0)
  assert.equal((await db.query('select trip_id from public.expenses')).rows[0].trip_id, null)
  console.log('Borrado de viaje: membresías en cascada y expenses conserva trip_id nulo: OK')
} finally {
  await db.close()
}
