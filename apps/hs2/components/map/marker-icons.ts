/**
 * Build MapLibre marker sprites: a coloured circular "pin" per feature type
 * with the type's white icon glyph, matching the Google My Maps look.
 *
 * react-icons components render to clean <svg><path/></svg>, so we
 * renderToStaticMarkup them, recolour to white, and nest inside a coloured
 * circle SVG, then rasterise to an HTMLImageElement and map.addImage() it.
 * RailTunnel is a chakra.svg (needs Chakra context under static render), so its
 * path is inlined directly here instead.
 */
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Map as MlMap } from 'maplibre-gl';

import type { FeatureType } from '@supabase/types';
import { featureTypes } from '@/components/feature/config';
import { TYPE_COLORS, MEDIA_COLOR } from './map-colors';
import { shotTypes, type ShotType } from './shot-type-config';

export const ICON_PREFIX = 'type-';
export const SHOT_ICON_PREFIX = 'shot-';

const LOGICAL = 44; // pin size in logical px
const DPR = 2; // rasterise at 2x for crisp retina sprites

// Types whose config icon is a chakra.svg (RailTunnel) — inline the path so we
// don't need Chakra context during static rendering.
const RAW_PATHS: Partial<Record<FeatureType, { viewBox: string; path: string }>> = {
  tunnel: {
    viewBox: '0 0 512 512',
    path: 'M256 0C114.6 0 0 114.6 0 256v192c0 35.3 28.7 64 64 64h41.4l64.3-64.3c-32.4-3.2-57.7-30.5-57.7-63.7V192c0-35.3 28.7-64 64-64h160c35.3 0 64 28.7 64 64v192c0 33.2-25.3 60.5-57.7 63.7l64.3 64.3H448c35.3 0 64-28.7 64-64V256C512 114.6 397.4 0 256 0zm105.4 512-64-64h-82.7l-64 64h210.7zM184 192c-13.3 0-24 10.7-24 24v80c0 13.3 10.7 24 24 24h144c13.3 0 24-10.7 24-24v-80c0-13.3-10.7-24-24-24H184zm104 192a32 32 0 1 0-64 0 32 32 0 1 0 64 0z',
  },
  cut_and_cover: {
    viewBox: '0 0 512 512',
    path: 'M256 0C114.6 0 0 114.6 0 256v192c0 35.3 28.7 64 64 64h41.4l64.3-64.3c-32.4-3.2-57.7-30.5-57.7-63.7V192c0-35.3 28.7-64 64-64h160c35.3 0 64 28.7 64 64v192c0 33.2-25.3 60.5-57.7 63.7l64.3 64.3H448c35.3 0 64-28.7 64-64V256C512 114.6 397.4 0 256 0zm105.4 512-64-64h-82.7l-64 64h210.7zM184 192c-13.3 0-24 10.7-24 24v80c0 13.3 10.7 24 24 24h144c13.3 0 24-10.7 24-24v-80c0-13.3-10.7-24-24-24H184zm104 192a32 32 0 1 0-64 0 32 32 0 1 0 64 0z',
  },
};

/** Render a react-icons component to a white, pin-positioned inner <svg>. */
function glyphFromIcon(icon: ComponentType<Record<string, unknown>>): string {
  return renderToStaticMarkup(createElement(icon))
    .replace(/\swidth="1em"/, '')
    .replace(/\sheight="1em"/, '')
    .replace(/fill="currentColor"/g, 'fill="#ffffff"')
    .replace(/stroke="currentColor"/g, 'stroke="#ffffff"')
    .replace(/^<svg/, '<svg x="12" y="11" width="20" height="20"');
}

/** Inner <svg> for a feature type's glyph (RAW_PATHS for chakra.svg icons). */
function glyphSvg(type: FeatureType): string {
  const raw = RAW_PATHS[type];
  if (raw) {
    return `<svg x="12" y="11" width="20" height="20" viewBox="${raw.viewBox}"><path d="${raw.path}" fill="#ffffff"/></svg>`;
  }
  return glyphFromIcon(featureTypes[type].icon as ComponentType<Record<string, unknown>>);
}

/** Wrap a glyph in a coloured circular pin. */
function wrapPin(color: string, glyph: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGICAL * DPR}" height="${LOGICAL * DPR}" viewBox="0 0 ${LOGICAL} ${LOGICAL}">` +
    `<circle cx="22" cy="22" r="18" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>` +
    glyph +
    `</svg>`
  );
}

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(LOGICAL * DPR, LOGICAL * DPR);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/**
 * Register a pin sprite for every feature type on the map. Idempotent (skips
 * images already present), so it can be re-run after a basemap/style switch
 * (a style change clears registered images). A single failing icon is skipped,
 * not fatal — that type falls back to its plain circle layer.
 */
export async function loadTypeIcons(map: MlMap): Promise<void> {
  const types = Object.keys(featureTypes) as FeatureType[];
  await Promise.all(
    types.map(async type => {
      const id = `${ICON_PREFIX}${type}`;
      if (map.hasImage(id)) return;
      try {
        const img = await svgToImage(wrapPin(TYPE_COLORS[type], glyphSvg(type)));
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: DPR });
      } catch {
        /* skip a single bad icon; the circle layer is the fallback */
      }
    })
  );
}

/**
 * Register a teal pin sprite per shot type for the video markers — same pin
 * shape as features but in the media colour, so videos stay visually distinct
 * while a drone clip, ground clip, vehicle pass, etc. read differently.
 * Idempotent; re-runnable after a style switch.
 */
export async function loadShotTypeIcons(map: MlMap): Promise<void> {
  const types = Object.keys(shotTypes) as ShotType[];
  await Promise.all(
    types.map(async t => {
      const id = `${SHOT_ICON_PREFIX}${t}`;
      if (map.hasImage(id)) return;
      try {
        const glyph = glyphFromIcon(
          shotTypes[t].icon as ComponentType<Record<string, unknown>>
        );
        const img = await svgToImage(wrapPin(MEDIA_COLOR, glyph));
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: DPR });
      } catch {
        /* skip a single bad icon; the circle layer is the fallback */
      }
    })
  );
}
