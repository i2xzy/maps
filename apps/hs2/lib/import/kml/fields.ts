// Pure field normalisers, each ported 1:1 from parse_kml.py and unit-tested
// against its cases. No I/O, no framework.

import type { ShotType, Url, YoutubeId } from '../types';

/** norm_ws: nbsp/tab/any whitespace -> single space, runs collapsed, trimmed. */
export function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const YOUTUBE_PATTERNS = [
  /[?&]v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /\/embed\/([\w-]{11})/,
  /\/shorts\/([\w-]{11})/,
];

export function youtubeId(url: string): YoutubeId | null {
  if (!url) return null;
  for (const pat of YOUTUBE_PATTERNS) {
    const m = pat.exec(url);
    if (m) return m[1] as YoutubeId;
  }
  return null;
}

/** Ordered keyword rules. The ordering is load-bearing: parse_kml.py's order. */
export function shotTypeFromLabel(raw: string): ShotType | null {
  const t = raw.trim().toLowerCase();
  if (t.includes('drone')) return 'drone';
  if (t.includes('elevated')) return 'elevated';
  if (
    t.includes('mockup') ||
    t.includes('render') ||
    t.includes('cgi') ||
    t.includes('animation') ||
    t.includes('illustration')
  ) {
    return 'illustration';
  }
  if (t.includes('aeroplane') || t.includes('aircraft') || t.includes('plane') || t.includes('flight')) {
    return 'aircraft';
  }
  if (t.includes('ground') || t.includes('point observation')) return 'ground';
  if (t.includes('vehicle') || t.includes('cab')) return 'vehicle';
  if (t.includes('mixed')) return 'mixed';
  return null;
}

/** A Link that is not an http(s) URL is junk (a pasted feature name, say). */
export function asUrl(link: string): Url | null {
  const u = link.trim();
  return /^https?:\/\//.test(u) ? (u as Url) : null;
}
