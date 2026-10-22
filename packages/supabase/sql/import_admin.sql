-- ============================================================================
-- KML import wizard: admin write access. No tables, no functions, no secret.
-- Every write runs as the signed-in admin; the DB refuses it unless the JWT
-- carries app_metadata.role = 'admin' (set once on your user in the dashboard:
-- Authentication > Users > your user > raw_app_meta_data = {"role":"admin"}).
--
-- Hand-applied in the Supabase SQL editor (local + prod). Re-runnable.
-- RLS policies change no schema shape, so database.ts does NOT need regenerating.
-- ============================================================================

-- Admin INSERT on the content tables (read-only to anon today). The wizard never
-- UPDATEs existing rows (relink-only), so INSERT is all it needs.
drop policy if exists admin_insert on public.media;
create policy admin_insert on public.media
  for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists admin_insert on public.media_features;
create policy admin_insert on public.media_features
  for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists admin_insert on public.creators;
create policy admin_insert on public.creators
  for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists admin_insert on public.feature_title_aliases;
create policy admin_insert on public.feature_title_aliases
  for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Reads need no policy here: media/creators/features are read by the public site,
-- and the operator enabled public read on feature_title_aliases.

-- Geometry probe (run once; rolls itself back). Confirms media.location accepts an
-- EWKT string straight from the client, so the commit needs no ST_GeomFromText RPC.
--   begin;
--   insert into public.media (title, url, type, shot_type, location)
--     values ('__ewkt_probe__', 'https://example.invalid/__probe__', 'video', 'drone',
--             'SRID=4326;POINT(-0.72 51.73)');
--   rollback;
