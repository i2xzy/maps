-- Creators with their distinct video count, for the creators list page.
--
-- A client-side "fetch all type='video' rows and dedupe in JS" count is capped
-- at PostgREST's max-rows (1000), silently undercounting once total video rows
-- exceed it. This view computes the count in one aggregate (no cap) and lets the
-- page fetch creators + counts in a single query, sorted server-side.
--
-- Dedup matches the app: a video is one distinct youtube_id; rows with no
-- youtube_id (one media row per Google My Maps pin) fall back to the row id,
-- exactly like `youtube_id || 'no-id-' || id` in the UI.
--
-- security_invoker = true so the view evaluates RLS as the calling user rather
-- than the view owner.
--
-- Apply in the Supabase SQL editor, then regenerate types
-- (packages/supabase/src/types/database.ts) from the live schema.
CREATE OR REPLACE VIEW public.creators_with_video_counts
WITH (security_invoker = true) AS
SELECT
  c.*,
  coalesce(v.video_count, 0) AS video_count
FROM creators c
LEFT JOIN (
  SELECT creator_id,
         count(DISTINCT coalesce(youtube_id, 'no-id-' || id::text)) AS video_count
  FROM media
  WHERE type = 'video'
    AND creator_id IS NOT NULL
  GROUP BY creator_id
) v ON v.creator_id = c.id;
