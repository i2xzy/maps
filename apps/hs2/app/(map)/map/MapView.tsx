'use client';

/**
 * Interactive HS2 map workspace (client-only — MapLibre needs the browser).
 *
 *   props.features / props.media / props.creators  (GeoJSON view rows)
 *        │  filter by type/status/year/creator  →  rowsToFeatureCollection
 *        ▼
 *   4 sources ── feature-points · feature-lines
 *             └─ media-points  · media-lines   (videos revealed at zoom 12)
 *        │
 *   click ─┬─ feature → open detail panel (info + related media + link)
 *          └─ media   → open video detail panel
 *   hover ─── marker → glow + lift · line → white casing (feature-state)
 *   search ─ pick result → fly to it + open detail panel
 *
 * Overlay UI (MapControlPanel / FeatureDetailPanel / MediaDetailPanel) floats
 * over a full-bleed map. Loaded via next/dynamic({ ssr:false }) so MapLibre
 * never runs server-side (the Children.only/SSR crash class from the Next 16
 * upgrade).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Source,
  Layer,
  NavigationControl,
  type MapRef,
  type MapLayerMouseEvent,
  type LayerProps,
} from 'react-map-gl/maplibre';
import type {
  StyleSpecification,
  ExpressionSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Alert, Box, Center, Text } from '@chakra-ui/react';

import {
  rowsToFeatureCollection,
  representativePoint,
  type GeoRow,
} from '@/utils/map-geojson';
import { dateInRange, earliestDate } from '@/utils/video-filters';
import { useLocalStorage } from 'react-use';
import type { FeatureType, FeatureStatus } from '@supabase/types';
import {
  typeColorExpression,
  DEFAULT_MEDIA_COLOR,
} from '@/components/map/map-colors';
import MapControlPanel, {
  type SearchResult,
  type VideoItem,
  type YearGroup,
  type CreatorGroup,
} from '@/components/map/MapControlPanel';
import MapSearch, { type MapSearchItem } from '@/components/map/MapSearch';
import { shotTypeLabel } from '@/components/map/shot-type-config';
import FeatureDetailPanel, {
  type SelectedFeature,
} from '@/components/map/FeatureDetailPanel';
import MediaDetailPanel, {
  type SelectedVideo,
} from '@/components/map/MediaDetailPanel';
import BasemapToggle from '@/components/map/BasemapToggle';
import {
  loadTypeIcons,
  loadCombinedMarkerIcons,
  ICON_PREFIX,
  COMBINED_PREFIX,
  type MarkerCombo,
} from '@/components/map/marker-icons';

export type Basemap = 'streets' | 'satellite';

const STREETS_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Esri World Imagery — free aerial tiles, no key. Reuse OpenFreeMap's glyphs so
// any symbol text layers render on this style too.
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles © Esri — World Imagery',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
};

const BASEMAP_STYLE: Record<Basemap, string | StyleSpecification> = {
  streets: STREETS_STYLE,
  satellite: SATELLITE_STYLE,
};

// HS2 phase 1 corridor: London (SE) to Birmingham (NW).
const INITIAL_VIEW = { longitude: -1.0, latitude: 52.0, zoom: 6.4 };

// Persist the camera (pan/zoom/rotation) in the URL query so a view is
// shareable/bookmarkable. We use history.replaceState (NOT the Next router) so
// updating it on every pan triggers no navigation or server re-render.
type SavedView = {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
};
function loadViewFromUrl(): SavedView | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const lng = parseFloat(p.get('lng') ?? '');
  const lat = parseFloat(p.get('lat') ?? '');
  const zoom = parseFloat(p.get('z') ?? '');
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(zoom)) {
    return null;
  }
  const bearing = parseFloat(p.get('b') ?? '');
  const pitch = parseFloat(p.get('p') ?? '');
  return {
    longitude: lng,
    latitude: lat,
    zoom,
    bearing: Number.isFinite(bearing) ? bearing : undefined,
    pitch: Number.isFinite(pitch) ? pitch : undefined,
  };
}
function saveViewToUrl(v: SavedView) {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams(window.location.search);
  p.set('lng', v.longitude.toFixed(5));
  p.set('lat', v.latitude.toFixed(5));
  p.set('z', v.zoom.toFixed(2));
  if (v.bearing) p.set('b', v.bearing.toFixed(1));
  else p.delete('b');
  if (v.pitch) p.set('p', v.pitch.toFixed(1));
  else p.delete('p');
  window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
}

// The active selection lives in the URL too (`sel=f:<id>` for a feature,
// `sel=v:<id>` for a video), so a selected structure/video is shareable and
// survives reload — the panel reopens, the list row highlights, and the marker
// keeps its glow. Same replaceState mechanism as the camera (no navigation).
type SelectionRef = { kind: 'f' | 'v'; id: string };
function loadSelFromUrl(): SelectionRef | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('sel');
  const m = raw?.match(/^([fv]):(.+)$/);
  return m ? { kind: m[1] as 'f' | 'v', id: m[2]! } : null;
}
function saveSelToUrl(sel: SelectionRef | null) {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams(window.location.search);
  if (sel) p.set('sel', `${sel.kind}:${sel.id}`);
  else p.delete('sel');
  window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
}

// Videos are dense secondary data — keep them off until the user zooms into an
// area. Features (the primary content) are always shown, unclustered.
const VIDEO_MIN_ZOOM = 12;

// Picking an item from a list/search flies IN to at least this zoom — but never
// zooms out if the user is already closer in (uses max(current, this)).
const SELECT_ZOOM = 15.5;

const L = {
  featurePoints: 'feature-points-markers',
  featureLines: 'feature-lines',
  mediaPoints: 'media-points-markers',
  mediaLines: 'media-lines',
} as const;

const INTERACTIVE_LAYERS = [
  L.featurePoints,
  L.featureLines,
  L.mediaPoints,
  L.mediaLines,
];
export type Creator = {
  id: string;
  name: string;
  color: string | null;
  imageUrl: string | null;
};

type Props = {
  features: GeoRow[];
  media: GeoRow[];
  creators: Creator[];
  /** Server-side RPC load failed — show a non-fatal banner over the map. */
  dataError?: boolean;
};

// Subtle hover affordance: a soft white glow drawn UNDER each point marker,
// faded in only for the feature whose `hover` feature-state is true. Because
// it's a paint property (circle-opacity), MapLibre toggles it GPU-side from a
// single map.setFeatureState() call — no React re-render per mousemove (unlike
// the old <Popup>, which repositioned + re-rendered on every move).
const isHovered: ExpressionSpecification = [
  'boolean',
  ['feature-state', 'hover'],
  false,
];

// The currently-selected marker/line keeps the same glow + casing + lift as a
// hover, persistently (it doesn't clear when the cursor moves off). Driven by a
// `selected` feature-state set from the active selection, separate from `hover`
// so the two never fight. `isActive` = hovered OR selected.
const isSelected: ExpressionSpecification = [
  'boolean',
  ['feature-state', 'selected'],
  false,
];
const isActive: ExpressionSpecification = ['any', isHovered, isSelected];

// Feature pins and video markers render at the same icon-size, so the hover
// glow is a single solid white halo behind the marker — a filled disc (not a
// thin ring) for a bolder, more "solid" highlight. circle-opacity is a paint
// property driven by feature-state, so MapLibre toggles it GPU-side from one
// setFeatureState() call — no React re-render.
const HOVER_FADE = { duration: 150 };

// Hard-edged opaque white ring with a slightly translucent fill (the Google My
// Maps highlight): blur 0 = crisp edge, the stroke is the solid ring, the fill
// lets the basemap show through a touch. Built per state-condition so the hover
// and selected glows can live on separate layers (hover mounted above) — `cond`
// gates both opacities so a layer only paints when its state is set.
const glowPaint = (
  cond: ExpressionSpecification
): CircleLayerSpecification['paint'] => ({
  'circle-radius': 20,
  'circle-blur': 0,
  'circle-color': '#FFFFFF',
  'circle-opacity': ['case', cond, 0.8, 0],
  'circle-opacity-transition': HOVER_FADE,
  'circle-stroke-width': 2,
  'circle-stroke-color': '#FFFFFF',
  'circle-stroke-opacity': ['case', cond, 1, 0],
  'circle-stroke-opacity-transition': HOVER_FADE,
});

const typeColor = typeColorExpression();

const featurePointLayer: LayerProps = {
  id: L.featurePoints,
  source: 'feature-points',
  type: 'circle',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': typeColor,
    'circle-radius': 7,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#FFFFFF',
  },
};

// Two glow layers per source: the persistent `selected` ring (mounted lower)
// and the transient `hover` ring (mounted above), so a hovered marker's
// highlight always sits on top of the selected one.
const featureSelectedGlowLayer: LayerProps = {
  id: 'feature-points-selected',
  source: 'feature-points',
  type: 'circle',
  filter: ['!', ['has', 'point_count']],
  paint: glowPaint(isSelected),
};

const featureHoverLayer: LayerProps = {
  id: 'feature-points-hover',
  source: 'feature-points',
  type: 'circle',
  filter: ['!', ['has', 'point_count']],
  paint: glowPaint(isHovered),
};

const mediaSelectedGlowLayer: LayerProps = {
  id: 'media-points-selected',
  source: 'media-points',
  type: 'circle',
  minzoom: VIDEO_MIN_ZOOM,
  filter: ['!', ['has', 'point_count']],
  paint: glowPaint(isSelected),
};

const mediaHoverLayer: LayerProps = {
  id: 'media-points-hover',
  source: 'media-points',
  type: 'circle',
  minzoom: VIDEO_MIN_ZOOM,
  filter: ['!', ['has', 'point_count']],
  paint: glowPaint(isHovered),
};

const featureLineLayer: LayerProps = {
  id: L.featureLines,
  source: 'feature-lines',
  type: 'line',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': typeColor, 'line-width': 3 },
};

// White casing drawn UNDER each coloured line, wider than it, so a white
// outline shows on both sides when the line is hovered. line-width reads
// feature-state ('hover'), so it's 0 (nothing drawn) until hovered — toggled
// GPU-side by the same setFeatureState() call as the markers.
const featureLineHoverLayer: LayerProps = {
  id: 'feature-lines-hover',
  source: 'feature-lines',
  type: 'line',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#FFFFFF',
    'line-width': 6,
    'line-opacity': ['case', isActive, 1, 0],
    'line-opacity-transition': HOVER_FADE,
  },
};

const mediaLineHoverLayer: LayerProps = {
  id: 'media-lines-hover',
  source: 'media-lines',
  type: 'line',
  minzoom: VIDEO_MIN_ZOOM,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#FFFFFF',
    'line-width': 5,
    'line-opacity': ['case', isActive, 1, 0],
    'line-opacity-transition': HOVER_FADE,
  },
};

// Feature pins and video markers share one icon-size so they read at the same
// scale on the map.
const MARKER_ICON_SIZE = 0.66;

// Type-icon pins drawn on top of the circle layer (the circle is the fallback
// if an icon sprite is missing, and stays the interactive target). Non-clustered
// points only.
const featureIconLayer: LayerProps = {
  id: 'feature-points-icons',
  source: 'feature-points',
  type: 'symbol',
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': ['concat', ICON_PREFIX, ['get', 'type']],
    'icon-size': MARKER_ICON_SIZE,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
};

// Re-draw of the SAME pins (same size — no growth) on top of every other
// marker, but invisible (icon-opacity 0) unless hovered. Because only the
// hovered marker fades in, it lifts above its neighbours — the Google-My-Maps
// hover lift, without resizing. icon-opacity is a paint property so it can read
// feature-state.
const featureRaiseLayout = {
  'icon-image': ['concat', ICON_PREFIX, ['get', 'type']],
  'icon-size': MARKER_ICON_SIZE,
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
} satisfies SymbolLayerSpecification['layout'];

const raisePaint = (
  cond: ExpressionSpecification
): SymbolLayerSpecification['paint'] => ({
  'icon-opacity': ['case', cond, 1, 0],
  'icon-opacity-transition': HOVER_FADE,
});

const featureSelectedRaiseLayer: LayerProps = {
  id: 'feature-points-selected-raise',
  source: 'feature-points',
  type: 'symbol',
  filter: ['!', ['has', 'point_count']],
  layout: featureRaiseLayout,
  paint: raisePaint(isSelected),
};

const featureRaiseLayer: LayerProps = {
  id: 'feature-points-raise',
  source: 'feature-points',
  type: 'symbol',
  filter: ['!', ['has', 'point_count']],
  layout: featureRaiseLayout,
  paint: raisePaint(isHovered),
};

/** Effective date for a video: recorded_date, else published_at. */
const videoDate = (r: GeoRow): string | null => {
  const d = r.recorded_date ?? r.published_at;
  return d ? String(d) : null;
};

/** Year bucket for a video row, from its effective date ("Undated" if none). */
const yearOf = (r: GeoRow): string => {
  const d = videoDate(r);
  return d ? d.slice(0, 4) : 'Undated';
};

export default function MapView({ features, media, creators, dataError }: Props) {
  const mapRef = useRef<MapRef>(null);

  // The point marker currently showing the hover glow (its source + generated
  // feature id), so we can clear its feature-state when the cursor moves off.
  const hoveredRef = useRef<{ source: string; id: string | number } | null>(null);
  // The marker(s) currently carrying the persistent `selected` feature-state, so
  // we can clear them when the selection changes. A feature id may belong to the
  // point or the line source, so we set/clear both (a no-op on the wrong one).
  const selectedMarkerRef = useRef<{ source: string; id: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);

  // Persisted preference (localStorage): satellite is the default basemap.
  // useLocalStorage can return undefined (cleared slot), so default it.
  const [storedBasemap, setBasemap] = useLocalStorage<Basemap>(
    'hs2.map.basemap',
    'satellite'
  );
  const basemap = storedBasemap ?? 'satellite';

  // Overlay state (session-only).
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());
  const [hiddenYears, setHiddenYears] = useState<Set<string>>(new Set());
  const [hiddenCreators, setHiddenCreators] = useState<Set<string>>(new Set());
  // Active video date-range filter, as ISO date strings from the DatePicker:
  // [] none, [from], or [from, to]. Stacks (AND) with the year/creator filters.
  const [dateRange, setDateRange] = useState<string[]>([]);
  // Seed the selection from the URL (sel=f:<id> / sel=v:<id>) on first render so
  // a shared/bookmarked link reopens the panel, highlights the list row, and
  // glows the marker — no restore effect (which would be a setState-in-effect).
  const [selected, setSelected] = useState<SelectedFeature | null>(() => {
    const sel = loadSelFromUrl();
    if (sel?.kind !== 'f') return null;
    const row = features.find(r => String(r.id) === sel.id);
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      type: row.type as FeatureType,
      status: (row.status as FeatureStatus) ?? null,
      chainage: typeof row.chainage === 'number' ? row.chainage : null,
    };
  });
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(() => {
    const sel = loadSelFromUrl();
    if (sel?.kind !== 'v') return null;
    const row = media.find(r => !!r.youtube_id && String(r.id) === sel.id);
    if (!row) return null;
    const cid = row.creator_id ? String(row.creator_id) : null;
    const c = cid ? creators.find(x => x.id === cid) : null;
    return {
      id: String(row.id),
      youtubeId: String(row.youtube_id),
      title: String(row.title ?? ''),
      recordedDate: row.recorded_date ? String(row.recorded_date) : null,
      publishedDate: row.published_at ? String(row.published_at) : null,
      shotType: row.shot_type ? String(row.shot_type) : null,
      creatorId: cid,
      creator: c?.name ?? null,
      creatorImage: c?.imageUrl ?? null,
    };
  });

  // Whether the combined marker sprites have been built (async, on the map).
  const [combinedReady, setCombinedReady] = useState(false);

  // Restore the camera from the URL on first render (falls back to the corridor).
  const initialView = useMemo(() => loadViewFromUrl() ?? INITIAL_VIEW, []);

  // Features: filtered by type/status at the source (rebuilding the GeoJSON)
  // rather than via a layer `filter`, so hidden rows are truly absent.
  const featureGeo = useMemo(() => {
    const rows = features.filter(
      r =>
        !hiddenTypes.has(String(r.type)) &&
        !(r.status != null && hiddenStatuses.has(String(r.status)))
    );
    return rowsToFeatureCollection(rows);
  }, [features, hiddenTypes, hiddenStatuses]);

  // Total feature counts per type / per status (the universe, for the filter
  // chips — independent of what's currently hidden).
  const { typeCounts, statusCounts } = useMemo(() => {
    const t: Record<string, number> = {};
    const s: Record<string, number> = {};
    for (const r of features) {
      const ty = String(r.type);
      t[ty] = (t[ty] ?? 0) + 1;
      if (r.status != null) {
        const st = String(r.status);
        s[st] = (s[st] ?? 0) + 1;
      }
    }
    return { typeCounts: t, statusCounts: s };
  }, [features]);

  // The map shows VIDEOS only (media rows with a youtube_id).
  const videoRows = useMemo(() => media.filter(m => !!m.youtube_id), [media]);

  // globalThis.Map: the bare `Map` is react-map-gl's component import.
  const creatorName = useMemo(() => {
    const m = new globalThis.Map<string, string>();
    for (const c of creators) m.set(c.id, c.name);
    return m;
  }, [creators]);
  const creatorColorMap = useMemo(() => {
    const m = new globalThis.Map<string, string | null>();
    for (const c of creators) m.set(c.id, c.color);
    return m;
  }, [creators]);
  const creatorImage = useMemo(() => {
    const m = new globalThis.Map<string, string | null>();
    for (const c of creators) m.set(c.id, c.imageUrl);
    return m;
  }, [creators]);

  // One entry per media row — NOT deduped by youtube_id. A single YouTube upload
  // is stored as multiple per-location "chapter" rows sharing a youtube_id, and
  // each is its own marker on the map, so each gets its own list entry (keeping
  // the list, the per-year/creator counts, and the markers in lockstep). Newest
  // first by effective date (recorded_date, else published_at).
  const allVideos = useMemo<VideoItem[]>(() => {
    const out: VideoItem[] = [];
    for (const r of videoRows) {
      const center = representativePoint(r.geojson);
      if (!center) continue;
      const cid = r.creator_id ? String(r.creator_id) : null;
      out.push({
        id: String(r.id),
        youtubeId: String(r.youtube_id),
        title: String(r.title ?? ''),
        recordedDate: r.recorded_date ? String(r.recorded_date) : null,
        publishedDate: r.published_at ? String(r.published_at) : null,
        shotType: r.shot_type ? String(r.shot_type) : null,
        creatorId: cid,
        // Marker colour: the creator's colour, else the grey default.
        color: (cid && creatorColorMap.get(cid)) || DEFAULT_MEDIA_COLOR,
        year: yearOf(r),
        center,
      });
    }
    const eff = (v: VideoItem) => v.recordedDate ?? v.publishedDate ?? '';
    return out.sort((a, b) => eff(b).localeCompare(eff(a)));
  }, [videoRows, creatorColorMap]);

  // Oldest video date (ISO) across the whole universe — the DatePicker's min.
  // From allVideos (not the filtered list) so the bound doesn't shift as filters
  // change.
  const earliestVideoDate = useMemo(
    () => earliestDate(allVideos.map(v => v.recordedDate ?? v.publishedDate)),
    [allVideos]
  );

  // Whether an effective date (recorded_date, else published_at) falls in the
  // active range. (See utils/video-filters for the rules + tests.)
  const inDateRange = useCallback(
    (eff: string | null) => dateInRange(eff, dateRange[0], dateRange[1]),
    [dateRange]
  );

  // Videos shown after the creator + date-range filters (the Videos tab handles
  // year visibility).
  const videoList = useMemo(
    () =>
      allVideos.filter(
        v =>
          !hiddenCreators.has(v.creatorId ?? '') &&
          inDateRange(v.recordedDate ?? v.publishedDate)
      ),
    [allVideos, hiddenCreators, inDateRange]
  );

  // Creators with videos (universe marker counts — one per chapter), most prolific first.
  const creatorList = useMemo<CreatorGroup[]>(() => {
    const counts = new globalThis.Map<string, number>();
    for (const v of allVideos) {
      if (!v.creatorId) continue;
      counts.set(v.creatorId, (counts.get(v.creatorId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        name: creatorName.get(id) ?? 'Unknown',
        // The effective marker colour (stored colour, else grey default).
        color: creatorColorMap.get(id) ?? DEFAULT_MEDIA_COLOR,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [allVideos, creatorName, creatorColorMap]);

  // Year groups (marker counts in visible creators — one per chapter), newest first.
  const years = useMemo<YearGroup[]>(() => {
    const counts = new globalThis.Map<string, number>();
    for (const v of videoList) counts.set(v.year, (counts.get(v.year) ?? 0) + 1);
    return [...counts.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => {
        if (a.year === 'Undated') return 1;
        if (b.year === 'Undated') return -1;
        return b.year.localeCompare(a.year);
      });
  }, [videoList]);

  // Map markers: videos in the visible years AND visible creators AND date range.
  const mediaGeo = useMemo(
    () =>
      rowsToFeatureCollection(
        videoRows.filter(
          r =>
            !hiddenYears.has(yearOf(r)) &&
            !hiddenCreators.has(r.creator_id ? String(r.creator_id) : '') &&
            inDateRange(videoDate(r))
        )
      ),
    [videoRows, hiddenYears, hiddenCreators, inDateRange]
  );

  // --- Creator colouring -----------------------------------------------------
  // Colours come from creators.color (set in the DB). A creator with a colour
  // gets it; everyone else is grey. No runtime extraction.
  const coloredCreators = useMemo(
    () => creators.filter((c): c is Creator & { color: string } => !!c.color),
    [creators]
  );

  // Colour per marker group: each coloured creator's colour + a grey default.
  const colorByGroup = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = { default: DEFAULT_MEDIA_COLOR };
    for (const c of coloredCreators) m[c.id] = c.color;
    return m;
  }, [coloredCreators]);

  // Only the (colour group × shot type) combos that actually occur, so we
  // rasterise ~the real number of sprites instead of every group × shot.
  const neededCombos = useMemo<MarkerCombo[]>(() => {
    const seen = new Set<string>();
    const combos: MarkerCombo[] = [];
    for (const r of videoRows) {
      const cid = r.creator_id ? String(r.creator_id) : '';
      const group = colorByGroup[cid] ? cid : 'default';
      const shot = r.shot_type ? String(r.shot_type) : 'mixed';
      const key = `${group}-${shot}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combos.push({ group, shot, color: colorByGroup[group] ?? DEFAULT_MEDIA_COLOR });
    }
    return combos;
  }, [videoRows, colorByGroup]);
  const combosRef = useRef(neededCombos);
  useEffect(() => {
    combosRef.current = neededCombos;
  }, [neededCombos]);

  // Feature types that occur as POINT markers — line features never reference
  // an icon sprite, so we only rasterise the pins actually drawn (e.g. no
  // tunnel/cut-and-cover pins). Mirrors neededCombos.
  const pointTypes = useMemo(() => {
    const s = new Set<string>();
    for (const r of features) {
      if ((r.geojson as { type?: string } | null)?.type === 'Point' && r.type) {
        s.add(String(r.type));
      }
    }
    return s;
  }, [features]);
  const pointTypesRef = useRef(pointTypes);
  useEffect(() => {
    pointTypesRef.current = pointTypes;
  }, [pointTypes]);

  // Line colour by creator (grey when the creator has no colour).
  const creatorColorExpr = useMemo<ExpressionSpecification | string>(() => {
    const pairs = coloredCreators.flatMap(c => [c.id, c.color]);
    if (pairs.length === 0) return DEFAULT_MEDIA_COLOR;
    return [
      'match',
      ['get', 'creator_id'],
      ...pairs,
      DEFAULT_MEDIA_COLOR,
    ] as unknown as ExpressionSpecification;
  }, [coloredCreators]);

  // icon-image: creator_id -> its combined-sprite prefix (else default), then
  // append the shot type → e.g. "cmb-<id>-drone".
  const markerImageExpr = useMemo<ExpressionSpecification>(() => {
    const pairs = coloredCreators.flatMap(c => [
      c.id,
      `${COMBINED_PREFIX}${c.id}-`,
    ]);
    const prefix =
      pairs.length > 0
        ? ['match', ['get', 'creator_id'], ...pairs, `${COMBINED_PREFIX}default-`]
        : `${COMBINED_PREFIX}default-`;
    return [
      'concat',
      prefix,
      ['coalesce', ['get', 'shot_type'], 'mixed'],
    ] as unknown as ExpressionSpecification;
  }, [coloredCreators]);

  // (Re)build the combined sprites whenever the needed combos change.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    loadCombinedMarkerIcons(map, neededCombos)
      // Mark ready even on failure: a sprite error must not leave the video
      // markers (and the hover overlays gated on this flag) permanently hidden.
      .then(() => setCombinedReady(true))
      .catch(() => setCombinedReady(true));
  }, [neededCombos]);

  // These layers wrap memoised expressions; useMemo keeps their object identity
  // stable so react-map-gl doesn't re-diff paint/layout on unrelated renders.

  // Single combined sprite per marker → markers occlude as whole units.
  const mediaMarkerLayer = useMemo<LayerProps>(
    () => ({
      id: L.mediaPoints,
      source: 'media-points',
      type: 'symbol',
      minzoom: VIDEO_MIN_ZOOM,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': markerImageExpr,
        'icon-size': MARKER_ICON_SIZE,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    }),
    [markerImageExpr]
  );

  // Hover lift for video markers — same sprite, same size, on top of all other
  // markers, faded in only when hovered (see featureRaiseLayer for the why).
  const mediaRaiseLayers = useMemo<{ selected: LayerProps; hover: LayerProps }>(
    () => {
      const layout = {
        'icon-image': markerImageExpr,
        'icon-size': MARKER_ICON_SIZE,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      } satisfies SymbolLayerSpecification['layout'];
      const base = {
        source: 'media-points',
        type: 'symbol',
        minzoom: VIDEO_MIN_ZOOM,
        filter: ['!', ['has', 'point_count']],
        layout,
      } satisfies Partial<LayerProps>;
      return {
        selected: {
          ...base,
          id: 'media-points-selected-raise',
          paint: raisePaint(isSelected),
        },
        hover: {
          ...base,
          id: 'media-points-raise',
          paint: raisePaint(isHovered),
        },
      };
    },
    [markerImageExpr]
  );

  const mediaLineLayer = useMemo<LayerProps>(
    () => ({
      id: L.mediaLines,
      source: 'media-lines',
      type: 'line',
      minzoom: VIDEO_MIN_ZOOM,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': creatorColorExpr,
        'line-width': 2,
      },
    }),
    [creatorColorExpr]
  );

  const toResult = useCallback((r: GeoRow): SearchResult | null => {
    const center = representativePoint(r.geojson);
    if (!center) return null;
    return {
      id: String(r.id),
      name: String(r.name ?? ''),
      type: r.type as FeatureType,
      center,
      chainage: typeof r.chainage === 'number' ? r.chainage : null,
    };
  }, []);

  // All features (name-sorted) for the floating search — find anything, even
  // a structure currently filtered off the map.
  const searchIndex = useMemo<SearchResult[]>(() => {
    const out = features
      .map(toResult)
      .filter((r): r is SearchResult => r !== null);
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [features, toResult]);

  // Floating search covers both structures and videos (all of them, regardless
  // of the active layer filters). Videos match on title + creator + YouTube id
  // + shot type, not just title.
  const searchItems = useMemo<MapSearchItem[]>(
    () => [
      ...searchIndex.map(result => ({
        kind: 'feature' as const,
        result,
        search: result.name,
      })),
      ...allVideos.map(video => {
        const creator = video.creatorId
          ? (creatorName.get(video.creatorId) ?? null)
          : null;
        const shot = video.shotType ? shotTypeLabel(video.shotType) : '';
        return {
          kind: 'video' as const,
          video,
          creator,
          search: [video.title, creator, video.youtubeId, shot]
            .filter(Boolean)
            .join(' '),
        };
      }),
    ],
    [searchIndex, allVideos, creatorName]
  );

  // Route-ordered (by chainage) browse list of the *visible* features for the
  // control panel.
  const featureList = useMemo<SearchResult[]>(() => {
    const out: SearchResult[] = [];
    for (const r of features) {
      if (hiddenTypes.has(String(r.type))) continue;
      if (r.status != null && hiddenStatuses.has(String(r.status))) continue;
      const res = toResult(r);
      if (res) out.push(res);
    }
    out.sort((a, b) => {
      const ca = a.chainage ?? Number.POSITIVE_INFINITY;
      const cb = b.chainage ?? Number.POSITIVE_INFINITY;
      return ca - cb || a.name.localeCompare(b.name);
    });
    return out;
  }, [features, hiddenTypes, hiddenStatuses, toResult]);

  const toggleInSet = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  // Bulk set membership for category/band toggles (hide or show many at once).
  const setKeys = (
    setter: typeof setHiddenTypes,
    keys: string[],
    hidden: boolean
  ) =>
    setter(prev => {
      const next = new Set(prev);
      for (const k of keys) {
        if (hidden) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  const onSetTypes = useCallback(
    (keys: string[], hidden: boolean) => setKeys(setHiddenTypes, keys, hidden),
    []
  );
  const onSetStatuses = useCallback(
    (keys: string[], hidden: boolean) => setKeys(setHiddenStatuses, keys, hidden),
    []
  );
  const onSetYears = useCallback(
    (keys: string[], hidden: boolean) => setKeys(setHiddenYears, keys, hidden),
    []
  );
  const onSetCreators = useCallback(
    (keys: string[], hidden: boolean) => setKeys(setHiddenCreators, keys, hidden),
    []
  );
  // "Only this one": hide every other year/creator in a single update.
  const onOnlyYear = useCallback(
    (year: string) =>
      setHiddenYears(new Set(years.map(y => y.year).filter(y => y !== year))),
    [years]
  );
  const onOnlyCreator = useCallback(
    (id: string) =>
      setHiddenCreators(
        new Set(creatorList.map(c => c.id).filter(c => c !== id))
      ),
    [creatorList]
  );
  // Picking a date range supersedes the manual year checkboxes — reset them
  // (show all years) so the range is the sole temporal filter and the toggles
  // don't silently subtract from it. Clearing the range leaves years all-shown.
  const onDateRangeChange = useCallback((range: string[]) => {
    setDateRange(range);
    if (range.length > 0) setHiddenYears(new Set());
  }, []);

  // The creators Listbox is multi-select where selected = shown; map its value
  // back to the hidden set (hidden = every creator not in the shown list).
  const onSetShownCreators = useCallback(
    (shownIds: string[]) => {
      const shown = new Set(shownIds);
      setHiddenCreators(
        new Set(creatorList.map(c => c.id).filter(id => !shown.has(id)))
      );
    },
    [creatorList]
  );
  const onResetFilters = useCallback(() => {
    setHiddenTypes(new Set());
    setHiddenStatuses(new Set());
  }, []);

  const selectFeatureProps = useCallback((props: Record<string, unknown>) => {
    if (!props.id || !props.type) return;
    setSelectedVideo(null);
    setSelected({
      id: String(props.id),
      name: String(props.name ?? ''),
      type: props.type as FeatureType,
      status: (props.status as FeatureStatus) ?? null,
      chainage: typeof props.chainage === 'number' ? props.chainage : null,
    });
  }, []);

  // Fly to a picked point, zooming in to at least SELECT_ZOOM but never zooming
  // out if the user is already closer in.
  const flyToPoint = useCallback((center: [number, number]) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center,
      zoom: Math.max(map.getZoom(), SELECT_ZOOM),
      duration: 900,
    });
  }, []);

  const onSelectResult = useCallback(
    (r: SearchResult) => {
      flyToPoint(r.center);
      const row = features.find(f => String(f.id) === r.id);
      if (row) selectFeatureProps(row);
    },
    [features, selectFeatureProps, flyToPoint]
  );

  const buildSelectedVideo = useCallback(
    (v: VideoItem): SelectedVideo => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      recordedDate: v.recordedDate,
      publishedDate: v.publishedDate,
      shotType: v.shotType,
      creatorId: v.creatorId,
      creator: v.creatorId ? (creatorName.get(v.creatorId) ?? null) : null,
      creatorImage: v.creatorId ? (creatorImage.get(v.creatorId) ?? null) : null,
    }),
    [creatorName, creatorImage]
  );

  const onSelectVideo = useCallback(
    (v: VideoItem) => {
      flyToPoint(v.center);
      setSelected(null);
      setSelectedVideo(buildSelectedVideo(v));
    },
    [buildSelectedVideo, flyToPoint]
  );

  // Floating-search pick: dispatch to the feature or video handler by kind.
  const onSelectSearch = useCallback(
    (item: MapSearchItem) => {
      if (item.kind === 'video') onSelectVideo(item.video);
      else onSelectResult(item.result);
    },
    [onSelectVideo, onSelectResult]
  );

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) {
        // clicked empty map
        setSelected(null);
        setSelectedVideo(null);
        return;
      }
      const layerId = feature.layer?.id;
      const props = feature.properties ?? {};

      if (layerId === L.mediaPoints || layerId === L.mediaLines) {
        if (props.youtube_id && props.id) {
          const creatorId = props.creator_id ? String(props.creator_id) : null;
          setSelected(null);
          setSelectedVideo({
            id: String(props.id),
            youtubeId: String(props.youtube_id),
            title: String(props.title ?? ''),
            recordedDate: props.recorded_date ? String(props.recorded_date) : null,
            publishedDate: props.published_at ? String(props.published_at) : null,
            shotType: props.shot_type ? String(props.shot_type) : null,
            creatorId,
            creator: creatorId ? (creatorName.get(creatorId) ?? null) : null,
            creatorImage: creatorId ? (creatorImage.get(creatorId) ?? null) : null,
          });
        }
        return;
      }

      if (layerId === L.featurePoints || layerId === L.featureLines) {
        selectFeatureProps(props);
      }
    },
    [selectFeatureProps, creatorName, creatorImage]
  );

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const feature = e.features?.[0];
    const layerId = feature?.layer?.id;

    map.getCanvas().style.cursor = layerId ? 'pointer' : '';

    // Toggle the hover feature-state on whatever interactive feature is under
    // the cursor — point markers (glow + lift) or lines (white casing). All
    // GPU-side via setFeatureState, so mousemove never triggers a re-render.
    const prev = hoveredRef.current;
    if (feature && feature.id != null) {
      // Already highlighting this exact feature — nothing to do.
      if (prev && prev.id === feature.id && prev.source === feature.source) return;
      if (prev) map.setFeatureState(prev, { hover: false });
      const next = { source: feature.source, id: feature.id };
      hoveredRef.current = next;
      map.setFeatureState(next, { hover: true });
    } else if (prev) {
      map.setFeatureState(prev, { hover: false });
      hoveredRef.current = null;
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = '';
    const prev = hoveredRef.current;
    if (map && prev) map.setFeatureState(prev, { hover: false });
    hoveredRef.current = null;
  }, []);

  // Clear the hover highlight whenever the source data changes (filter/creator
  // toggle). The cursor may be sitting still over a marker, so no mouseleave
  // fires — without this the glow/lift stays stuck on a now-removed feature id.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    const prev = hoveredRef.current;
    if (map && prev) map.setFeatureState(prev, { hover: false });
    hoveredRef.current = null;
  }, [featureGeo, mediaGeo]);

  // --- Selection ↔ URL ↔ map highlight --------------------------------------
  // (Initial restore is seeded in the useState initializers above.)
  // Mirror the active selection into the URL (shareable, survives reload).
  useEffect(() => {
    saveSelToUrl(
      selected
        ? { kind: 'f', id: selected.id }
        : selectedVideo
          ? { kind: 'v', id: selectedVideo.id }
          : null
    );
  }, [selected, selectedVideo]);

  // Keep the persistent `selected` feature-state in sync with the selection so
  // the chosen marker/line stays glowing. Re-runs when the sources (re)load or
  // the filtered data changes (setData can drop feature-state), so the glow
  // survives filter toggles. A feature id can live in the point OR line source,
  // so we set both — a no-op on whichever doesn't contain it.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    for (const m of selectedMarkerRef.current) {
      map.setFeatureState(m, { selected: false });
    }
    selectedMarkerRef.current = [];
    const id = selected?.id ?? selectedVideo?.id ?? null;
    if (!id) return;
    const sources = selected
      ? ['feature-points', 'feature-lines']
      : ['media-points', 'media-lines'];
    const next = sources.map(source => ({ source, id }));
    for (const m of next) map.setFeatureState(m, { selected: true });
    selectedMarkerRef.current = next;
  }, [selected, selectedVideo, combinedReady, iconsReady, featureGeo, mediaGeo]);

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const addCombined = () =>
      loadCombinedMarkerIcons(map, combosRef.current)
        .then(() => setCombinedReady(true))
        .catch(() => setCombinedReady(true));
    loadTypeIcons(map, pointTypesRef.current)
      .then(() => setIconsReady(true))
      .catch(() => undefined);
    addCombined();
    // A style switch (basemap change) clears registered images — re-add them.
    map.on('styledata', () => {
      loadTypeIcons(map, pointTypesRef.current).catch(() => undefined);
      addCombined();
    });
  }, []);

  // Floating controls clear the control panel: offset by the panel width when
  // open, by the collapsed icon when closed (the bottom corner is free when
  // collapsed). sm+ only — on mobile the panel is a full-width overlay.
  const topLeftInset = panelCollapsed
    ? { base: '56px', sm: '56px' }
    : { base: '56px', sm: '324px' };
  const bottomLeftInset = panelCollapsed
    ? { base: '12px', sm: '12px' }
    : { base: '12px', sm: '324px' };

  if (failed) {
    return (
      <Center position='absolute' inset={0} p={6}>
        <Box textAlign='center' maxW='sm'>
          <Text fontWeight='semibold' mb={2}>
            Map unavailable
          </Text>
          <Text color='fg.muted'>
            The map could not load. Your browser may not support WebGL, or the
            basemap service is temporarily unreachable.
          </Text>
        </Box>
      </Center>
    );
  }

  return (
    <Box position='absolute' inset={0}>
      <Map
        ref={mapRef}
        initialViewState={initialView}
        mapStyle={BASEMAP_STYLE[basemap]}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        onLoad={onLoad}
        onMoveEnd={e => saveViewToUrl(e.viewState)}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onError={e => {
          // Only a WebGL/context failure is fatal (blank the map + show the
          // fallback). Transient tile/source errors (a single 404 from the
          // basemap CDN) must NOT take down the whole map — log and ignore.
          const msg = String(e?.error?.message ?? '');
          if (/webgl|context lost|failed to (initialize|create)/i.test(msg)) {
            setFailed(true);
          } else {
            console.warn('[map] non-fatal error:', msg);
          }
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position='bottom-right' />

        {/* Lines under points. White casing first (under the coloured line) so
            a white outline shows when the line is hovered; promoteId='id' lets
            the casing target the hovered line via feature-state. */}
        <Source id='feature-lines' type='geojson' data={featureGeo.lines} promoteId='id'>
          <Layer {...featureLineHoverLayer} />
          <Layer {...featureLineLayer} />
        </Source>
        <Source id='media-lines' type='geojson' data={mediaGeo.lines} promoteId='id'>
          <Layer {...mediaLineHoverLayer} />
          <Layer {...mediaLineLayer} />
        </Source>

        {/* Features: all shown individually (no clustering). promoteId='id'
            uses the row id as the feature id so the hover glow can target it
            via feature-state. */}
        <Source id='feature-points' type='geojson' data={featureGeo.points} promoteId='id'>
          <Layer {...featurePointLayer} />
          {iconsReady && <Layer {...featureIconLayer} />}
        </Source>
        {/* Videos: one combined sprite per marker (creator-coloured circle +
            shot glyph) so markers occlude as whole units. Hidden until zoomed
            in (minzoom). */}
        <Source id='media-points' type='geojson' data={mediaGeo.points} promoteId='id'>
          {combinedReady && <Layer {...mediaMarkerLayer} />}
        </Source>

        {/* Highlight overlays. Mounted together — and only once BOTH marker
            types have loaded — so react-map-gl appends them in one batch on top
            of every normal marker, as two stacked groups: the SELECTED group
            (its glow ring + lifted icon), then the HOVER group (glow ring +
            lifted icon) above it — so the hovered marker AND its highlight always
            sit above the selected one. Within each group the glow is below its
            lifted icon. Gating matters: react-map-gl appends new layers above
            existing ones rather than re-sorting to match JSX, so an ungated glow
            would mount first and end up *beneath* the markers. Each layer paints
            only its feature-state (selected / hover). */}
        {iconsReady && combinedReady && (
          <>
            <Layer {...featureSelectedGlowLayer} />
            <Layer {...mediaSelectedGlowLayer} />
            <Layer {...featureSelectedRaiseLayer} />
            <Layer {...mediaRaiseLayers.selected} />
            <Layer {...featureHoverLayer} />
            <Layer {...mediaHoverLayer} />
            <Layer {...featureRaiseLayer} />
            <Layer {...mediaRaiseLayers.hover} />
          </>
        )}
      </Map>

      <MapControlPanel
        collapsed={panelCollapsed}
        onToggleCollapsed={() => setPanelCollapsed(c => !c)}
        hiddenTypes={hiddenTypes}
        hiddenStatuses={hiddenStatuses}
        typeCounts={typeCounts}
        statusCounts={statusCounts}
        onSetTypes={onSetTypes}
        onSetStatuses={onSetStatuses}
        onResetFilters={onResetFilters}
        features={featureList}
        onSelectResult={onSelectResult}
        years={years}
        hiddenYears={hiddenYears}
        onToggleYear={year => setHiddenYears(s => toggleInSet(s, year))}
        onSetYears={onSetYears}
        onOnlyYear={onOnlyYear}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        earliestVideoDate={earliestVideoDate}
        videos={videoList}
        onSelectVideo={onSelectVideo}
        creators={creatorList}
        hiddenCreators={hiddenCreators}
        onToggleCreator={id => setHiddenCreators(s => toggleInSet(s, id))}
        onSetCreators={onSetCreators}
        onSetShownCreators={onSetShownCreators}
        onOnlyCreator={onOnlyCreator}
        selectedId={selected?.id ?? selectedVideo?.id ?? null}
        selectedKind={selected ? 'feature' : selectedVideo ? 'video' : null}
      />

      <MapSearch items={searchItems} onSelect={onSelectSearch} left={topLeftInset} />

      <BasemapToggle basemap={basemap} onChange={setBasemap} left={bottomLeftInset} />

      <FeatureDetailPanel feature={selected} onClose={() => setSelected(null)} />

      <MediaDetailPanel video={selectedVideo} onClose={() => setSelectedVideo(null)} />

      {dataError && (
        <Alert.Root
          status='warning'
          position='absolute'
          bottom={4}
          left='50%'
          transform='translateX(-50%)'
          width='fit-content'
          maxW='calc(100% - 24px)'
          zIndex={10}
          borderRadius='lg'
          shadow='lg'
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn&rsquo;t load all map data</Alert.Title>
            <Alert.Description>
              Some structures or videos didn&rsquo;t load. Try refreshing.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </Box>
  );
}
