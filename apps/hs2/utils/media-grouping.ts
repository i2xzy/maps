/**
 * Media grouping utilities.
 *
 * A single YouTube video is stored as several `media` rows — one per Google My
 * Maps pin it was imported from. Each pin carries a ?t= offset (or none), a
 * title, and feature links. These helpers turn a set of sibling rows (same
 * youtube_id) into the chapter list the video page shows, and collapse them to
 * one entry where a video should appear once (news feed, creator page).
 *
 *   media rows (siblings, same youtube_id)
 *        │  each: ?t= offset, title, feature links
 *        ▼
 *   Chapter[]  sorted by offset; no-timestamp pins first (seconds = 0)
 */
import type { FeatureStatus, FeatureType } from '@supabase/types';

export type ChapterFeature = {
  id: string;
  name: string;
  type: FeatureType;
  status: FeatureStatus | null;
  chainage: number | null;
};

export type Chapter = {
  title: string;
  seconds: number;
  features: ChapterFeature[];
};

/** A media row treated as one segment ("chapter") of a larger video. */
export type MediaSegment = {
  url: string | null;
  title: string | null;
  media_features?: { features: ChapterFeature | null }[] | null;
};

/** Parse the ?t= / &t= chapter offset (in seconds) from a YouTube URL. */
export function getTimestampSeconds(url: string | null): number | null {
  const match = url?.match(/[?&]t=(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/** Strip a leading "YYYY-MM-DD " date prefix from a pin title. */
export function stripDatePrefix(title: string): string {
  return title.replace(/^\d{4}-\d{2}-\d{2}\s+/, '');
}

/** Extract a leading "YYYY-MM-DD" date from a pin title, or "". */
export function getDatePrefix(title: string): string {
  return title.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '';
}

/** Format seconds as m:ss for a chapter label. */
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Build an ordered chapter list from the segments of one video.
 * Returns [] for a single-segment video — there is nothing to navigate between.
 */
export function buildChapters(segments: MediaSegment[]): Chapter[] {
  if (segments.length <= 1) return [];

  return segments
    .map(seg => ({
      title: stripDatePrefix(seg.title ?? '') || 'Chapter',
      seconds: getTimestampSeconds(seg.url) ?? 0,
      features:
        seg.media_features
          ?.map(mf => mf.features)
          .filter((f): f is ChapterFeature => f != null) ?? [],
    }))
    .sort((a, b) => a.seconds - b.seconds);
}

/** Minimum fields needed to group a list of media rows into one-per-video. */
export type MediaListItem = {
  id: string;
  youtube_id: string | null;
  url: string | null;
  title: string | null;
};

/**
 * Collapse media rows to one entry per video for listing contexts (news feed,
 * creator page). Rows sharing a youtube_id merge into a single representative
 * entry whose title combines the first and last segment labels. Rows without a
 * youtube_id (images, un-grouped) pass through unchanged. Input order is
 * preserved, so a list already sorted by published_at stays sorted.
 */
export function groupVideosByYoutubeId<T extends MediaListItem>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.youtube_id || `no-id-${row.id}`;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  const result: T[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        (getTimestampSeconds(a.url) ?? 0) - (getTimestampSeconds(b.url) ?? 0)
    );
    const first = sorted[0];
    if (!first) continue; // groups always hold >= 1 row; satisfies the checker
    const last = sorted[sorted.length - 1];

    // Single segment, or missing titles to combine: pass the row through.
    if (sorted.length === 1 || !last || !first.title || !last.title) {
      result.push(first);
      continue;
    }

    const date = getDatePrefix(first.title);
    const combinedTitle = date
      ? `${date} ${stripDatePrefix(first.title)} to ${stripDatePrefix(last.title)}`
      : `${stripDatePrefix(first.title)} to ${stripDatePrefix(last.title)}`;

    // Spread + field override loses the generic identity; cast back to T.
    // Safe: every key of T comes from `first`, only `title` (string) changes.
    result.push({ ...first, title: combinedTitle } as T);
  }
  return result;
}

/** Union the features across all segments of a video, deduped by id. */
export function collectFeatures(segments: MediaSegment[]): ChapterFeature[] {
  const byId = new Map<string, ChapterFeature>();
  for (const seg of segments) {
    for (const mf of seg.media_features ?? []) {
      if (mf.features) byId.set(mf.features.id, mf.features);
    }
  }
  return Array.from(byId.values());
}
