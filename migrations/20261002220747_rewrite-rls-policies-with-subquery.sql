-- Cierra la deuda rls-policy-perf del advisor de InsForge (issue #65): con
-- auth.uid() suelto, la funcion se re-evalua por fila; envuelta en
-- (select auth.uid()) el planificador la evalua una sola vez.
--
-- Sin cambio de semantica: mismo propietario (user_id en las tablas de usuario
-- e id en profiles), mismos comandos (select/insert/update/delete) y mismos
-- WITH CHECK que las migraciones 20260913181842_create-app-schema.sql,
-- 20260915160000_create-journal-entries.sql y
-- 20260915160001_create-journal-photos.sql.
--
-- Idempotente: drop policy if exists + create policy, se puede reaplicar.
--
-- No entra storage.objects (ya usa (select auth.jwt() ->> 'sub') y no lo reporta
-- el advisor) ni public.users (retirada en 20260918210000_drop-public-users.sql).
-- Tampoco se tocan los indices sin uso: son un falso positivo con la base vacia.

-- Tablas con propietario por user_id: las cuatro policies de siempre.
do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'expenses', 'notes', 'tasks', 'bookings',
    'itinerary_activities', 'alerts', 'budgets',
    'journal_entries', 'journal_photos'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using ((select auth.uid()) = user_id)', t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check ((select auth.uid()) = user_id)', t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- profiles: la propiedad va por `id` y no tiene politica de delete.
do $$
declare
  t text;
begin
  foreach t in array array['profiles']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using ((select auth.uid()) = id)', t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check ((select auth.uid()) = id)', t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id)', t || '_update_own', t);
  end loop;
end $$;
