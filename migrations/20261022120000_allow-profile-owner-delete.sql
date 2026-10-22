-- Supresión desde el cliente: profiles solo tenía SELECT/INSERT/UPDATE.
-- No otorga acceso a perfiles ajenos ni a auth.users.
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);
