// British date parsing, ported field-for-field from parse_kml.py's parse_date.
// ISO strings are built and validated explicitly (no `new Date()` parsing), so
// day-in-month and leap years behave exactly like Python's strptime.

import type { IsoDate } from '../types';

const MONTH_BY_NAME: Record<string, number> = {};
[
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
].forEach((full, i) => {
  MONTH_BY_NAME[full] = i + 1;
  MONTH_BY_NAME[full.slice(0, 3)] = i + 1;
});

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

/** POSIX strptime %y pivot: 00-68 -> 2000-2068, 69-99 -> 1969-1999. */
function parseYear(token: string | undefined): number | null {
  if (token === undefined) return null;
  if (/^\d{4}$/.test(token)) return Number(token);
  if (/^\d{2}$/.test(token)) {
    const yy = Number(token);
    return yy <= 68 ? 2000 + yy : 1900 + yy;
  }
  return null;
}

function parseDay(token: string | undefined): number | null {
  if (token === undefined) return null;
  return /^\d{1,2}$/.test(token) ? Number(token) : null;
}

function monthOf(token: string | undefined): number | null {
  return MONTH_BY_NAME[(token ?? '').toLowerCase()] ?? null;
}

function format(year: number, month: number, day: number): IsoDate {
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}` as IsoDate;
}

/**
 * '6 Jun 2024' | 'Jan 2024' | '5 Sept 2024' | '28 Jul 24' | '24Aug 2025' -> IsoDate.
 * Returns null unless the WHOLE string is a date (the signal parse_kml.py uses
 * for swap detection). Month-only inputs take day 01, or the last day of the
 * month when `monthEnd` is set (the recorded-date rule).
 */
export function parseBritishDate(raw: string, opts?: { monthEnd?: boolean }): IsoDate | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/\bSept\b/g, 'Sep');
  s = s.replace(/(\d)([A-Za-z])/g, '$1 $2');
  const tokens = s.split(/\s+/);

  if (tokens.length === 3) {
    const day = parseDay(tokens[0]);
    const month = monthOf(tokens[1]);
    const year = parseYear(tokens[2]);
    if (day === null || month === null || year === null) return null;
    if (day < 1 || day > daysInMonth(year, month)) return null;
    return format(year, month, day);
  }

  if (tokens.length === 2) {
    const month = monthOf(tokens[0]);
    const year = parseYear(tokens[1]);
    if (month === null || year === null) return null;
    const day = opts?.monthEnd ? daysInMonth(year, month) : 1;
    return format(year, month, day);
  }

  return null;
}

/** A structurally-valid `YYYY-MM-DD` that is also a real calendar date, else null. */
export function asValidIsoDate(s: string): IsoDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return s as IsoDate;
}
