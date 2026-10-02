-- Las FKs alerts.trip_id y budgets.trip_id no tenian indice: borrar o actualizar
-- un viaje obligaba a Postgres a escanear la tabla hija entera para localizar las
-- filas que apuntan a el. Con la tabla casi vacia no se nota; en cuanto haya
-- volumen, cada borrado de viaje paga un seq scan.
--
-- Lo reporta el advisor del backend como missing-fk-index (warning) en
-- public.alerts.alerts_trip_id_fkey y public.budgets.budgets_trip_id_fkey.
--
-- Solo indices: no se tocan columnas, politicas, RLS ni Grants.
create index if not exists idx_alerts_trip_id on public.alerts (trip_id);
create index if not exists idx_budgets_trip_id on public.budgets (trip_id);