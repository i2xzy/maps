// parseLayer: a pure port of parse_kml.py. fast-xml-parser gives a DOM-free,
// isomorphic tree we walk element by element. Field problems become warnings
// (data), never exceptions.

import { XMLParser } from 'fast-xml-parser';

import type { Geometry, IsoDate, ParseWarning, ParsedLayer, Pin, Url, YoutubeId } from '../types';
import { asValidIsoDate, parseBritishDate } from './dates';
import { asUrl, normaliseWhitespace, shotTypeFromLabel, youtubeId } from './fields';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  isArray: (name) => ['Placemark', 'Data', 'Folder', 'Document'].includes(name),
});

type XmlNode = Record<string, unknown>;

function rawText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (typeof node === 'object' && '#text' in (node as XmlNode)) {
    const t = (node as XmlNode)['#text'];
    return t == null ? '' : String(t);
  }
  return '';
}

const text = (node: unknown): string => normaliseWhitespace(rawText(node));

function collectPlacemarks(node: unknown, out: XmlNode[]): void {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const el of node) collectPlacemarks(el, out);
    return;
  }
  for (const [key, value] of Object.entries(node as XmlNode)) {
    if (key === 'Placemark') {
      for (const pm of Array.isArray(value) ? value : [value]) out.push(pm as XmlNode);
    } else {
      collectPlacemarks(value, out);
    }
  }
}

function findFirst(node: unknown, tag: string): unknown {
  if (node == null || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const el of node) {
      const r = findFirst(el, tag);
      if (r !== undefined) return r;
    }
    return undefined;
  }
  for (const [key, value] of Object.entries(node as XmlNode)) {
    if (key === tag) return Array.isArray(value) ? value[0] : value;
    const r = findFirst(value, tag);
    if (r !== undefined) return r;
  }
  return undefined;
}

/** text of the first <geomTag>/<coordinates>, or undefined if that geometry is absent. */
function firstCoords(pm: XmlNode, geomTag: string): string | undefined {
  const geom = findFirst(pm, geomTag);
  if (geom === undefined) return undefined;
  const coords = findFirst(geom, 'coordinates');
  return coords === undefined ? undefined : text(coords);
}

function coordsToGeometry(coordText: string, kind: 'point' | 'line'): Geometry | null {
  const pts: Array<readonly [number, number]> = [];
  for (const triple of coordText.split(/\s+/)) {
    if (!triple) continue;
    const parts = triple.split(',');
    if (parts.length >= 2) {
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) pts.push([lon, lat]);
    }
  }
  const first = pts[0];
  if (first === undefined) return null;
  if (kind === 'point') return { kind: 'point', lon: first[0], lat: first[1] };
  return { kind: 'line', coords: pts };
}

function readData(pm: XmlNode): Record<string, string> {
  const data: Record<string, string> = {};
  const ed = findFirst(pm, 'ExtendedData');
  if (ed == null || typeof ed !== 'object') return data;
  const dataNodes = (ed as XmlNode).Data;
  const list = Array.isArray(dataNodes) ? dataNodes : dataNodes ? [dataNodes] : [];
  for (const d of list) {
    if (d == null || typeof d !== 'object') continue;
    const name = (d as XmlNode)['@_name'];
    if (name == null) continue;
    data[String(name)] = text((d as XmlNode).value);
  }
  return data;
}

export function parseLayer(kml: string): ParsedLayer {
  const root = parser.parse(kml) as unknown;
  const placemarks: XmlNode[] = [];
  collectPlacemarks(root, placemarks);

  const pins: Pin[] = [];
  const warnings: ParseWarning[] = [];

  placemarks.forEach((pm, ordinal) => {
    const title = text(pm.name);
    const data = readData(pm);

    const ptCoords = firstCoords(pm, 'Point');
    const lsCoords = firstCoords(pm, 'LineString');
    const geometry: Geometry | null =
      ptCoords !== undefined
        ? coordsToGeometry(ptCoords, 'point')
        : lsCoords !== undefined
          ? coordsToGeometry(lsCoords, 'line')
          : null;

    const channel = data.Channel ?? '';
    const rawLink = data.Link ?? '';
    let url: Url | null = null;
    if (rawLink) {
      url = asUrl(rawLink);
      if (url === null) warnings.push({ pin: ordinal, kind: 'non-url-link', link: rawLink });
    }

    const youtube: YoutubeId | null = url ? youtubeId(url) : null;
    const rawType = data.Type ?? '';
    const shotType = shotTypeFromLabel(rawType);
    const publishedRaw = data.date ?? '';
    const recordedRaw = data.recorded_date ?? '';
    let publishedAt = parseBritishDate(publishedRaw);
    const recordedDate = parseBritishDate(recordedRaw, { monthEnd: true });
    const description = data.description ?? '';

    const titlePrefix = /^(\d{4}-\d{2}-\d{2})\b/.exec(title)?.[1];
    const titleDate: IsoDate | null = titlePrefix ? asValidIsoDate(titlePrefix) : null;
    if (publishedAt === null && titleDate !== null) {
      publishedAt = titleDate;
      if (publishedRaw) {
        warnings.push({ pin: ordinal, kind: 'date-from-title', titleDate, raw: publishedRaw });
      }
    }

    if (parseBritishDate(channel) !== null) {
      warnings.push({ pin: ordinal, kind: 'misplaced-date', field: 'channel', value: channel });
    } else if (channel && asUrl(channel) !== null) {
      // A URL in the Channel field is a paste mistake (usually the video link),
      // not a channel name. Flag it so the planner blocks the pin as a source error.
      warnings.push({ pin: ordinal, kind: 'channel-is-url', value: channel });
    }
    if (description && parseBritishDate(description) !== null) {
      warnings.push({ pin: ordinal, kind: 'misplaced-date', field: 'description', value: description });
    }
    if (shotType === null) {
      warnings.push({ pin: ordinal, kind: 'unmapped-shot-type', raw: rawType });
    }
    if (youtube === null && url !== null) {
      warnings.push({ pin: ordinal, kind: 'no-youtube-id', url });
    }
    if (publishedRaw && publishedAt === null) {
      warnings.push({ pin: ordinal, kind: 'unparsed-date', field: 'published', raw: publishedRaw });
    }
    if (recordedRaw && recordedDate === null) {
      warnings.push({ pin: ordinal, kind: 'unparsed-date', field: 'recorded', raw: recordedRaw });
    }

    pins.push({
      ordinal,
      url,
      title,
      channel,
      description: description === '' ? null : description,
      youtubeId: youtube,
      shotType,
      rawType,
      publishedAt,
      publishedRaw,
      recordedDate,
      recordedRaw,
      geometry,
    });
  });

  return { pins, warnings };
}
