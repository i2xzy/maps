'use client';

/**
 * Interactive HS2 map workspace (client-only — MapLibre needs the browser).
 *
 *   props.features / props.media  (GeoJSON view rows)
 *        │  filter by layer/type/status  →  rowsToFeatureCollection
 *        ▼
 *   4 sources ── feature-points (clustered) · feature-lines
 *             └─ media-points  (clustered) · media-lines
 *        │
 *   click ─┬─ cluster   → zoom to expansion
 *          ├─ feature   → open detail panel (info + related media + link)
 *          └─ media     → /media/[id]
 *   hover ─── point/line → popup (name/title + status)
 *   search ─ pick result → fly to it + open detail panel
 *
 * Overlay UI (MapControlPanel / FeatureDetailPanel / MapLegend) floats over a
 * full-bleed map. Loaded via next/dynamic({ ssr:false }) so MapLibre never runs
 * server-side (the Children.only/SSR crash class from the Next 16 upgrade).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  type MapRef,
  type MapLayerMouseEvent,
  type LayerProps,
} from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Text } from '@chakra-ui/react';

import {
  rowsToFeatureCollection,
  representativePoint,
  type GeoRow,
} from '@/utils/map-geojson';
import { usePersistedState } from '@/utils/use-persisted-state';
import type { FeatureType, FeatureStatus } from '@supabase/types';
import { featureStatuses } from '@/components/feature/config';
import { typeColorExpression, MEDIA_COLOR } from '@/components/map/map-colors';
import MapControlPanel, {
  type SearchResult,
  type VideoItem,
  type YearGroup,
} from '@/components/map/MapControlPanel';
import MapSearch from '@/components/map/MapSearch';
import FeatureDetailPanel, {
  type SelectedFeature,
} from '@/components/map/FeatureDetailPanel';
import MediaDetailPanel, {
  type SelectedVideo,
} from '@/components/map/MediaDetailPanel';
import BasemapToggle from '@/components/map/BasemapToggle';
import {
  loadTypeIcons,
  loadShotTypeIcons,
  ICON_PREFIX,
  SHOT_ICON_PREFIX,
} from '@/components/map/marker-icons';

export type Basemap = 'streets' | 'satellite';

const STREETS_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Esri World Imagery — free aerial tiles, no key. Reuse OpenFreeMap's glyphs so
// the cluster-count labels render on this style too.
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

// Videos are dense secondary data — keep them off until the user zooms into an
// area. Features (the primary content) are always shown, unclustered.
const VIDEO_MIN_ZOOM = 12;

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
const POPUP_LAYERS: string[] = [
  L.featurePoints,
  L.featureLines,
  L.mediaPoints,
  L.mediaLines,
];
const MEDIA_LAYERS: string[] = [L.mediaPoints, L.mediaLines];

type Props = { features: GeoRow[]; media: GeoRow[] };

type HoverInfo = {
  longitude: number;
  latitude: number;
  title: string;
  subtitle?: string;
};

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

const featureLineLayer: LayerProps = {
  id: L.featureLines,
  source: 'feature-lines',
  type: 'line',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': typeColor, 'line-width': 3 },
};

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
    'icon-size': 0.72,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
};

const mediaPointLayer: LayerProps = {
  id: L.mediaPoints,
  source: 'media-points',
  type: 'circle',
  minzoom: VIDEO_MIN_ZOOM,
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': MEDIA_COLOR,
    'circle-radius': 6,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#FFFFFF',
  },
};

const mediaLineLayer: LayerProps = {
  id: L.mediaLines,
  source: 'media-lines',
  type: 'line',
  minzoom: VIDEO_MIN_ZOOM,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': MEDIA_COLOR, 'line-width': 2, 'line-dasharray': [2, 1] },
};

// Shot-type icon pins over the media circle layer (circle is the fallback if a
// sprite is missing, and stays the interactive target). Non-clustered points.
const mediaIconLayer: LayerProps = {
  id: 'media-points-icons',
  source: 'media-points',
  type: 'symbol',
  minzoom: VIDEO_MIN_ZOOM,
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': ['concat', SHOT_ICON_PREFIX, ['get', 'shot_type']],
    'icon-size': 0.64,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
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

export default function MapView({ features, media }: Props) {
  const mapRef = useRef<MapRef>(null);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);

  // Persisted preference (localStorage): satellite is the default basemap.
  const [basemap, setBasemap] = usePersistedState<Basemap>(
    'hs2.map.basemap',
    'satellite'
  );

  // Overlay state (session-only).
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());
  const [hiddenYears, setHiddenYears] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);

  // Features: filtered by type/status. Re-clustering happens automatically when
  // the source data changes (a layer `filter` would leave clusters counting
  // hidden points).
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

  // The map shows VIDEOS only (media rows with a youtube_id), split into
  // per-year layers the Videos tab toggles.
  const videoRows = useMemo(() => media.filter(m => !!m.youtube_id), [media]);

  // One entry per video (dedup by youtube_id), ALL years, newest first by
  // effective date. The panel groups these by year; the map markers below
  // filter independently by hiddenYears. (globalThis.Map: the bare `Map` is
  // react-map-gl's component import.)
  const videoList = useMemo<VideoItem[]>(() => {
    const byId = new globalThis.Map<string, VideoItem>();
    for (const r of videoRows) {
      const yt = String(r.youtube_id);
      if (byId.has(yt)) continue;
      const center = representativePoint(r.geojson);
      if (!center) continue;
      byId.set(yt, {
        id: String(r.id),
        youtubeId: yt,
        title: String(r.title ?? ''),
        recordedDate: r.recorded_date ? String(r.recorded_date) : null,
        publishedDate: r.published_at ? String(r.published_at) : null,
        shotType: r.shot_type ? String(r.shot_type) : null,
        year: yearOf(r),
        center,
      });
    }
    const eff = (v: VideoItem) => v.recordedDate ?? v.publishedDate ?? '';
    return [...byId.values()].sort((a, b) => eff(b).localeCompare(eff(a)));
  }, [videoRows]);

  // Year groups (deduped video counts), newest first, Undated last.
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

  // Map markers: videos in the visible years only (re-clusters on change).
  const mediaGeo = useMemo(
    () =>
      rowsToFeatureCollection(videoRows.filter(r => !hiddenYears.has(yearOf(r)))),
    [videoRows, hiddenYears]
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

  const onSelectResult = useCallback(
    (r: SearchResult) => {
      mapRef.current?.flyTo({ center: r.center, zoom: 13, duration: 900 });
      const row = features.find(f => String(f.id) === r.id);
      if (row) selectFeatureProps(row);
    },
    [features, selectFeatureProps]
  );

  const onSelectVideo = useCallback((v: VideoItem) => {
    mapRef.current?.flyTo({ center: v.center, zoom: 13, duration: 900 });
    setSelected(null);
    setSelectedVideo({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      recordedDate: v.recordedDate,
      publishedDate: v.publishedDate,
      shotType: v.shotType,
    });
  }, []);

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
          setSelected(null);
          setSelectedVideo({
            id: String(props.id),
            youtubeId: String(props.youtube_id),
            title: String(props.title ?? ''),
            recordedDate: props.recorded_date ? String(props.recorded_date) : null,
            publishedDate: props.published_at ? String(props.published_at) : null,
            shotType: props.shot_type ? String(props.shot_type) : null,
          });
        }
        return;
      }

      if (layerId === L.featurePoints || layerId === L.featureLines) {
        selectFeatureProps(props);
      }
    },
    [selectFeatureProps]
  );

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    const feature = e.features?.[0];
    const layerId = feature?.layer?.id;

    if (map) map.getCanvas().style.cursor = layerId ? 'pointer' : '';

    if (feature && layerId && POPUP_LAYERS.includes(layerId)) {
      const props = feature.properties ?? {};
      const isMedia = MEDIA_LAYERS.includes(layerId);
      const status = props.status as keyof typeof featureStatuses | undefined;
      setHover({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        title: String(props.name ?? props.title ?? ''),
        subtitle:
          !isMedia && status && featureStatuses[status]
            ? featureStatuses[status].label
            : undefined,
      });
    } else {
      setHover(null);
    }
  }, []);

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    Promise.all([loadTypeIcons(map), loadShotTypeIcons(map)])
      .then(() => setIconsReady(true))
      .catch(() => undefined);
    // A style switch (basemap change) clears registered images — re-add them.
    map.on('styledata', () => {
      loadTypeIcons(map).catch(() => undefined);
      loadShotTypeIcons(map).catch(() => undefined);
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
      <Box position='absolute' inset={0} display='flex' alignItems='center' justifyContent='center' p={6}>
        <Box textAlign='center' maxW='sm'>
          <Text fontWeight='semibold' mb={2}>
            Map unavailable
          </Text>
          <Text color='fg.muted'>
            The map could not load. Your browser may not support WebGL, or the
            basemap service is temporarily unreachable.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box position='absolute' inset={0}>
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        mapStyle={BASEMAP_STYLE[basemap]}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        onLoad={onLoad}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
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

        {/* Lines under points. */}
        <Source id='feature-lines' type='geojson' data={featureGeo.lines}>
          <Layer {...featureLineLayer} />
        </Source>
        <Source id='media-lines' type='geojson' data={mediaGeo.lines}>
          <Layer {...mediaLineLayer} />
        </Source>

        {/* Features: all shown individually (no clustering). */}
        <Source id='feature-points' type='geojson' data={featureGeo.points}>
          <Layer {...featurePointLayer} />
          {iconsReady && <Layer {...featureIconLayer} />}
        </Source>
        {/* Videos: unclustered, hidden until zoomed in (minzoom per layer) so
            the point markers appear together with the flyover lines. */}
        <Source id='media-points' type='geojson' data={mediaGeo.points}>
          <Layer {...mediaPointLayer} />
          {iconsReady && <Layer {...mediaIconLayer} />}
        </Source>

        {hover && (
          <Popup
            longitude={hover.longitude}
            latitude={hover.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={12}
          >
            {/* MapLibre's popup background is always white, so pin the text to
                a fixed dark colour (don't inherit the theme fg, which is white
                in dark mode and disappears). */}
            <Box fontSize='sm' color='gray.800'>
              <Text fontWeight='semibold'>{hover.title}</Text>
              {hover.subtitle && <Text color='gray.600'>{hover.subtitle}</Text>}
            </Box>
          </Popup>
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
        videos={videoList}
        onSelectVideo={onSelectVideo}
      />

      <MapSearch features={searchIndex} onSelect={onSelectResult} left={topLeftInset} />

      <BasemapToggle basemap={basemap} onChange={setBasemap} left={bottomLeftInset} />

      <FeatureDetailPanel feature={selected} onClose={() => setSelected(null)} />

      <MediaDetailPanel video={selectedVideo} onClose={() => setSelectedVideo(null)} />
    </Box>
  );
}
