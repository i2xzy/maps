-- Interactive map: GeoJSON views + single-call fetch RPCs.
--
-- features_geo / media_geo expose each row's PostGIS geometry as parsed GeoJSON
-- (PostgREST otherwise returns geometry as unusable WKB hex). Precision is
-- capped at 6 dp (~0.1 m) to shrink the linestring-heavy payload.
--
-- features_geo_all / media_geo_all return the WHOLE row set as one jsonb array.
-- PostgREST caps any table/view/SETOF response at db-max-rows (1000), so a
-- direct select on media_geo (>1000 rows) would need client-side .range()
-- pagination. A function that RETURNS jsonb returns ONE row — the cap never
-- applies — so the map loads every feature/video in a single request.
--
-- security_invoker / SECURITY INVOKER: everything runs as the calling role, so
-- the base tables' RLS still applies; the GRANTs let the anon/authenticated API
-- roles read.
--
-- Apply in the Supabase SQL editor, then regenerate types
-- (packages/supabase/src/types/database.ts) from the live schema.

-- ----------------------------------------------------------------------------
-- Views
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.features_geo
  WITH (security_invoker = on) AS
SELECT
  id,
  name,
  type,
  status,
  chainage,
  chainage_end,
  route_element_id,
  ST_AsGeoJSON(geometry, 6)::json AS geojson
FROM features
WHERE geometry IS NOT NULL;

GRANT SELECT ON public.features_geo TO anon, authenticated;

CREATE OR REPLACE VIEW public.media_geo
  WITH (security_invoker = on) AS
SELECT
  id,
  title,
  type,
  youtube_id,
  recorded_date,
  ST_AsGeoJSON(location, 6)::json AS geojson,
  -- Appended LAST so CREATE OR REPLACE VIEW works without a DROP (Postgres only
  -- allows adding view columns at the end). Order is irrelevant to PostgREST.
  published_at,
  shot_type,
  creator_id
FROM media
WHERE location IS NOT NULL;

GRANT SELECT ON public.media_geo TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Single-call fetch RPCs (return the whole set as one jsonb array; each element
-- matches the client GeoRow shape, so rowsToFeatureCollection() consumes it).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.features_geo_all()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'type', type,
      'status', status,
      'chainage', chainage,
      'geojson', geojson
    )),
    '[]'::jsonb
  )
  FROM features_geo;
$$;

GRANT EXECUTE ON FUNCTION public.features_geo_all() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.media_geo_all()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'id', id,
      'title', title,
      'type', type,
      'youtube_id', youtube_id,
      'recorded_date', recorded_date,
      'published_at', published_at,
      'shot_type', shot_type,
      'creator_id', creator_id,
      'geojson', geojson
    )),
    '[]'::jsonb
  )
  FROM media_geo;
$$;

GRANT EXECUTE ON FUNCTION public.media_geo_all() TO anon, authenticated;
