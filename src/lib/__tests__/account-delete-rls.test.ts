/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Ejecuta Postgres real (PGlite) fuera del runtime de jsdom/Jest. Usa las
// políticas del repo, role sin privilegios y dos identidades; no simula RLS.
it('RLS impide borrar filas, perfiles y objetos de otro usuario, incluso sin filtro cliente', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { PGlite } from '@electric-sql/pglite';
    const db = new PGlite();
    const tables = ['trips','expenses','notes','tasks','bookings','itinerary_activities','alerts','budgets','journal_entries','journal_photos'];
    const a = '10000000-0000-4000-8000-000000000001';
    const b = '20000000-0000-4000-8000-000000000002';
    try {
      await db.exec(\`create role authenticated; create schema auth; create schema storage;
        create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub')::uuid $$;
        create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub', current_setting('request.jwt.claim.sub')) $$;
        grant usage on schema auth to authenticated;
        grant execute on all functions in schema auth to authenticated;
      \`);
      for (const table of [...tables, 'profiles']) {
        await db.exec(\`create table public.\${table} (id uuid primary key, user_id uuid);
          alter table public.\${table} enable row level security;
          grant select, insert, update, delete on public.\${table} to authenticated;
          insert into public.\${table} values ('\${a}', '\${a}'), ('\${b}', '\${b}');\`);
      }
      await db.exec(\`create table storage.objects (key text primary key, uploaded_by text);
        insert into storage.objects values ('a/photo', '\${a}'), ('b/photo', '\${b}');\`);
      for (const migration of [
        '20261002220747_rewrite-rls-policies-with-subquery.sql',
        '20261022120000_allow-profile-owner-delete.sql',
        '20260917120000_storage-objects-owner-only.sql',
      ]) await db.exec(readFileSync('migrations/' + migration, 'utf8'));
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a]);
      for (const table of [...tables, 'profiles']) {
        const foreign = await db.query(\`delete from public.\${table} where id = $1 returning id\`, [b]);
        assert.equal(foreign.rows.length, 0, table + ': foreign delete');
        const all = await db.query(\`delete from public.\${table} returning id\`);
        assert.deepEqual(all.rows.map(r => r.id), [a], table + ': unfiltered delete');
      }
      assert.equal((await db.query("delete from storage.objects where key = 'b/photo' returning key")).rows.length, 0);
      assert.deepEqual((await db.query('delete from storage.objects returning key')).rows.map(r => r.key), ['a/photo']);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [b]);
      for (const table of [...tables, 'profiles']) assert.deepEqual((await db.query(\`select id from public.\${table}\`)).rows.map(r => r.id), [b]);
      assert.deepEqual((await db.query('select key from storage.objects')).rows.map(r => r.key), ['b/photo']);
      console.log('RLS DELETE: 11 tablas y storage; datos ajenos intactos');
    } finally { await db.close(); }
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', source], { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 });
  expect(output).toContain('RLS DELETE: 11 tablas y storage; datos ajenos intactos');
}, 65000);

it('la migración DELETE de profiles limita el propietario por auth.uid', () => {
  expect(readFileSync('migrations/20261022120000_allow-profile-owner-delete.sql', 'utf8'))
    .toContain('for delete to authenticated using ((select auth.uid()) = id)');
});
