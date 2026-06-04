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
  seconds: number;
  /** Date from the pin title, e.g. "Oct 2022" ("" if none). */
  date: string;
  /** Place from the pin title (title minus the date prefix), "" if none. */
  place: string;
  /** Features this chapter covers (shown per-chapter only when they vary). */
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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a pin title's leading date for display. The curated prefix is
 * "YYYY-MM-DD"; the day is often "00" (unknown), so collapse to month + year.
 *   "2022-10-00 Colne Valley" -> "Oct 2022"
 *   "2023-09-15 Colne Valley" -> "15 Sep 2023"
 *   "Some place" (no prefix)  -> ""
 */
export function formatPinDate(title: string): string {
  const m = title.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const year = m[1];
  const month = m[2];
  const day = m[3];
  if (!year || !month || !day) return '';
  const monthName = MONTHS[parseInt(month, 10) - 1] ?? '';
  const dayPart = day === '00' ? '' : `${parseInt(day, 10)} `;
  return `${dayPart}${monthName} ${year}`.trim();
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
      seconds: getTimestampSeconds(seg.url) ?? 0,
      date: seg.title ? formatPinDate(seg.title) : '',
      place: seg.title ? stripDatePrefix(seg.title) : '',
      features:
        seg.media_features
          ?.map(mf => mf.features)
          .filter((f): f is ChapterFeature => f != null) ?? [],
    }))
    .sort((a, b) => a.seconds - b.seconds);
}

/**
 * True when chapters cover different features (e.g. a drone flyover passing
 * several structures), false when every chapter shares the same feature set
 * (e.g. one viaduct filmed at several dates). Drives whether the chapter list
 * repeats feature links per row.
 */
export function chaptersHaveVaryingFeatures(chapters: Chapter[]): boolean {
  const signature = (c: Chapter) =>
    c.features
      .map(f => f.id)
      .sort()
      .join(',');
  const first = chapters[0] ? signature(chapters[0]) : '';
  return chapters.some(c => signature(c) !== first);
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
