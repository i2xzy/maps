// Title grammar, ported from import-template.sql: strip the "YYYY-MM-DD " prefix,
// split the body on " | " and " & ", detect "A to B" ranges, and the one
// normalisation (norm) that the DB and TS share for name equality.

import type { IsoDate, NormName, TitleParts } from './types';
import { asValidIsoDate } from './kml/dates';
import { normaliseWhitespace } from './kml/fields';

/** lower(trim(collapse-whitespace(x))). The one equality the DB and TS share. */
export function norm(s: string): NormName {
  return normaliseWhitespace(s).toLowerCase() as NormName;
}

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})\s+/;
const SEPARATORS = /\s*[|&]\s*/g;
const RANGE = /\s+to\s+/i;

export function splitTitle(title: string): TitleParts {
  const match = DATE_PREFIX.exec(title);
  let datePrefix: IsoDate | null = null;
  let body = title;
  if (match) {
    datePrefix = asValidIsoDate(match[1] ?? '');
    body = title.slice(match[0].length);
  }
  body = body.trim();
  const candidates = body
    .replace(SEPARATORS, '|')
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c !== '');
  return { datePrefix, body, candidates };
}

/** "A to B" -> endpoints (first and last on case-insensitive " to "), else null. */
export function rangeEndpoints(candidate: string): { from: string; to: string } | null {
  const parts = candidate.split(RANGE);
  if (parts.length < 2) return null;
  return { from: (parts[0] ?? '').trim(), to: (parts[parts.length - 1] ?? '').trim() };
}

/**
 * Rewrites each candidate in `title` that has a fix to its target feature name,
 * preserving the date prefix and the original separators. A title with no
 * fixable candidate is returned unchanged.
 */
export function applyCandidateFixes(title: string, fixes: ReadonlyMap<NormName, string>): string {
  if (fixes.size === 0) return title;
  const match = DATE_PREFIX.exec(title);
  const prefix = match ? match[0] : '';
  const body = title.slice(prefix.length);
  const rebuilt = body
    .split(/(\s*[|&]\s*)/)
    .map((segment, i) => (i % 2 === 1 ? segment : fixSegment(segment, fixes)))
    .join('');
  return prefix + rebuilt;
}

// Fix a whole candidate, or, for a range candidate, each endpoint while keeping the
// "to" connectors, so a typo fix on a range endpoint actually rewrites the title.
function fixSegment(segment: string, fixes: ReadonlyMap<NormName, string>): string {
  const direct = fixes.get(norm(segment));
  if (direct !== undefined) return direct;
  const parts = segment.split(/(\s+to\s+)/i);
  if (parts.length < 3) return segment;
  return parts.map((p, i) => (i % 2 === 1 ? p : fixes.get(norm(p)) ?? p)).join('');
}
