-- public.users nacio para ensureUserExists() (ADR-001) y ya no la escribe ni la lee nadie:
-- 0 filas, 0 FKs que la referencien; el perfil vive en public.profiles.
-- Ver docs/DECISIONS/ADR-012-retirada-del-codigo-bff-y-public-users.md.
-- Se aplica con el CLI de InsForge bajo aprobacion humana; no la aplica la app.
drop table if exists public.users cascade;
