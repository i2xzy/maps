-- ============================================================================
-- Migration: Dedupe media rows by youtube_id, lift chapter timestamps into
--            media_features junction.
-- Date:     2026-05-11
-- Author:   isaac.raskin@beatchain.com
-- See:      ~/.gstack/projects/i2xzy-maps/isaacraskin-i2xzy-office-hours-design-20260508-165500.md
-- ============================================================================
--
-- HOW TO RUN:
--   Primary path: Supabase Dashboard -> SQL Editor.
--     Paste this entire file into a new query, then click Run.
--     The BEGIN/COMMIT wrapping makes this a single atomic transaction:
--     any error rolls back every change. Look for the green success indicator.
--   Alternative: `psql $SUPABASE_CONNECTION_STRING -f migrations/2026-05-11-dedupe-media.sql`
--
-- BEFORE RUNNING:
--   1. Run pre-migration audit queries (see test plan) to count duplicates,
--      check for non-standard t= URL formats, and verify media.location type.
--   2. Snapshot via Supabase Dashboard -> Database -> Backups, or take a
--      manual export of `media` and `media_features` to CSV.
--   3. Rehearse on a Supabase branch first (Dashboard -> Branches -> Create).
--
-- AFTER RUNNING:
--   1. Run post-migration verification queries (see test plan).
--   2. From `packages/supabase`, regenerate TypeScript types:
--        pnpm supabase gen types typescript --project-id $PROJECT_ID \
--          > packages/supabase/src/types/database.ts
--   3. Commit `packages/supabase/src/types/database.ts`.
--   4. Deploy app code that reads the new `timestamp_start_seconds` and `role`
--      columns from `media_features`.
--
-- ASSUMPTIONS:
--   - `media_features` PRIMARY KEY is `(media_id, feature_id)`.
--     If not, the ON CONFLICT clause below needs to change.
--   - `youtube_id` is the canonical per-video identifier.
--   - URLs that include a chapter timestamp use `?t=Xs` or `&t=Xs` format
--     (Google My Maps export convention). Non-standard formats are flagged
--     by the pre-migration audit and must be hand-fixed before this runs.
--   - `media.search_text` is either a generated column or maintained by a
--     trigger that fires on UPDATE.
--
-- KNOWN LIMITATIONS:
--   - If a single video chapters into the same feature at multiple distinct
--     timestamps (e.g., a drone circles back to the same viaduct), this
--     migration's ON CONFLICT logic keeps the first-seen timestamp and
--     discards subsequent ones. Run the post-migration audit (see test plan
--     query D) to count such cases. If >=3, escalate to a separate
--     `media_chapters` table per the design doc.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: Add chapter-timestamp columns to media_features junction.
-- Idempotent via IF NOT EXISTS so a re-run is safe.
-- ----------------------------------------------------------------------------
ALTER TABLE media_features
  ADD COLUMN IF NOT EXISTS timestamp_start_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS timestamp_end_seconds   INTEGER;

-- ----------------------------------------------------------------------------
-- STEP 2: Widen media.location to accept any geometry (POINT, LINESTRING,
--         POLYGON) if it is currently POINT-restricted. Run the audit query
--         first to know if this is needed.
--
-- Audit query (run separately, not part of this migration):
--   SELECT geometrytype(location), COUNT(*) FROM media WHERE location IS NOT NULL
--     GROUP BY geometrytype(location);
--
-- If only ST_Point appears AND you have LINESTRING WKT to import,
-- uncomment the ALTER below.
-- ----------------------------------------------------------------------------
-- ALTER TABLE media
--   ALTER COLUMN location TYPE geometry(Geometry, 4326)
--   USING location::geometry(Geometry, 4326);

-- ----------------------------------------------------------------------------
-- STEP 3-5: Dedupe media rows by youtube_id. For each duplicate group:
--   a. Pick canonical row (prefer no ?t= in url, else lowest id).
--   b. For each non-canonical row in the group:
--      - Parse ?t=Xs from its url.
--      - Merge its media_features rows into the canonical row, backfilling
--        media_features.role from the non-canonical media.title and
--        media_features.timestamp_start_seconds from the parsed t= value.
--      - Delete the non-canonical media row (cascades media_features).
--   c. Strip ?t= from the canonical row's url.
--
-- Runs as a PL/pgSQL DO block because the per-group merge is procedural.
-- Wrapped in the outer transaction; any error rolls back the whole thing.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  yt_id            TEXT;
  canonical_id     UUID;
  non_canon_row    RECORD;
  parsed_ts        INTEGER;
  parsed_match     TEXT[];
BEGIN
  FOR yt_id IN
    SELECT youtube_id
    FROM media
    WHERE youtube_id IS NOT NULL
    GROUP BY youtube_id
    HAVING COUNT(*) > 1
  LOOP
    -- Canonical: prefer the row with no ?t= in url, then lowest id for stability.
    -- Boolean ORDER BY: FALSE sorts before TRUE, so "url has no t=" comes first.
    SELECT id INTO canonical_id
    FROM media
    WHERE youtube_id = yt_id
    ORDER BY
      (url ~ '[?&]t=') ASC,
      id ASC
    LIMIT 1;

    -- For every other row in this youtube_id group:
    FOR non_canon_row IN
      SELECT id, url, title
      FROM media
      WHERE youtube_id = yt_id
        AND id <> canonical_id
    LOOP
      -- Parse the chapter timestamp from the url's ?t=Xs or &t=Xs param.
      parsed_ts := NULL;
      parsed_match := regexp_match(non_canon_row.url, '[?&]t=(\d+)s?(?:&|$)');
      IF parsed_match IS NOT NULL THEN
        parsed_ts := parsed_match[1]::INTEGER;
      END IF;

      -- Merge each media_features row from the non-canonical media row into
      -- the canonical media row, with timestamp + role backfill.
      -- ON CONFLICT: if the canonical already linked to this feature, only
      -- overwrite timestamp/role when the existing values are NULL (preserve
      -- more-specific data, first-write-wins for ambiguous cases).
      INSERT INTO media_features
        (media_id, feature_id, is_cover, role, timestamp_start_seconds)
      SELECT
        canonical_id,
        feature_id,
        is_cover,
        COALESCE(role, non_canon_row.title),
        parsed_ts
      FROM media_features
      WHERE media_id = non_canon_row.id
      ON CONFLICT (media_id, feature_id) DO UPDATE
        SET timestamp_start_seconds = EXCLUDED.timestamp_start_seconds,
            role                    = COALESCE(media_features.role, EXCLUDED.role)
        WHERE media_features.timestamp_start_seconds IS NULL;

      -- Delete the non-canonical media row. media_features cascades.
      DELETE FROM media WHERE id = non_canon_row.id;
    END LOOP;

    -- Strip the ?t= or &t= chapter param from the canonical url.
    -- Handle both formats and clean up any dangling separators.
    UPDATE media
    SET url = regexp_replace(
                regexp_replace(url, '[?&]t=\d+s?', '', 'g'),
                '[?&]$', ''
              )
    WHERE id = canonical_id;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 6: Add UNIQUE constraint on youtube_id to prevent regression.
-- This will fail loudly if the dedup loop above missed any duplicates,
-- which is the correct safety check.
-- ----------------------------------------------------------------------------
ALTER TABLE media
  ADD CONSTRAINT media_youtube_id_key UNIQUE (youtube_id);

-- ----------------------------------------------------------------------------
-- STEP 7: Refresh search_text for all surviving media rows.
-- The no-op UPDATE fires the trigger or regenerates the generated column,
-- ensuring the search index reflects the cleaned-up URLs and any other
-- post-dedup state.
-- ----------------------------------------------------------------------------
UPDATE media SET id = id;

COMMIT;

-- ============================================================================
-- STEP 8 (post-migration, outside this SQL file):
--
-- Regenerate Supabase TypeScript types so the new media_features columns
-- appear in `packages/supabase/src/types/database.ts`:
--
--   cd packages/supabase
--   pnpm supabase gen types typescript --project-id $SUPABASE_PROJECT_ID \
--     > src/types/database.ts
--
-- Commit the regenerated file before deploying app code that reads
-- timestamp_start_seconds or the backfilled role values.
-- ============================================================================
