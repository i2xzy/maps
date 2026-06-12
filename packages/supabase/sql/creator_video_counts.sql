-- Distinct video count per creator, computed server-side.
--
-- The creators list page shows "N videos" on each card. A single client-side
-- SELECT of all type='video' rows is capped at PostgREST's max-rows (1000), so
-- once total video rows exceed that the counts are silently truncated. This
-- function does the dedup + count in one aggregate, with no row cap.
--
-- Dedup matches the app: a video is one distinct youtube_id; rows with no
-- youtube_id (one media row per Google My Maps pin) fall back to the row id,
-- exactly like `youtube_id || 'no-id-' || id` in the UI.
--
-- Apply in the Supabase SQL editor, then regenerate types
-- (packages/supabase/src/types/database.ts) from the live schema.
CREATE OR REPLACE FUNCTION public.creator_video_counts()
RETURNS TABLE (creator_id uuid, video_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT creator_id,
         count(DISTINCT coalesce(youtube_id, 'no-id-' || id::text)) AS video_count
  FROM media
  WHERE type = 'video'
    AND creator_id IS NOT NULL
  GROUP BY creator_id;
$$;

GRANT EXECUTE ON FUNCTION public.creator_video_counts() TO anon, authenticated;
