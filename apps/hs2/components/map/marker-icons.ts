/**
 * Build MapLibre marker sprites: a coloured circular "pin" per feature type
 * with the type's white icon glyph, matching the Google My Maps look.
 *
 * react-icons components render to clean <svg><path/></svg>, so we
 * renderToStaticMarkup them, recolour to white, and nest inside a coloured
 * circle SVG, then rasterise to an HTMLImageElement and map.addImage() it.
 */
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Map as MlMap } from 'maplibre-gl';

import type { FeatureType } from '@supabase/types';
import { featureTypes } from '@/components/feature/config';
import { TYPE_COLORS } from './map-colors';
import { shotTypes, type ShotType } from './shot-type-config';

export const ICON_PREFIX = 'type-';
export const COMBINED_PREFIX = 'cmb-';

const LOGICAL = 44; // pin size in logical px
const DPR = 2; // rasterise at 2x for crisp retina sprites

const GLYPH_SIZE = 20; // default glyph box within the 44px pin

/**
 * Render an icon component to a white, pin-centred inner <svg> at the given box
 * size. A bigger size makes the glyph fill more of the pin — used to even out
 * icons that carry more internal padding than the rest (e.g. the Phosphor drone
 * and Maki viewpoint vs the denser FA solids).
 */
function glyphFromIcon(
  icon: ComponentType<Record<string, unknown>>,
  size: number = GLYPH_SIZE
): string {
  const x = (LOGICAL - size) / 2; // centre horizontally in the pin
  const y = x - 1; // nudge up 1px (matches the original 20px placement)
  return renderToStaticMarkup(createElement(icon))
    .replace(/\swidth="1em"/, '')
    .replace(/\sheight="1em"/, '')
    .replace(/fill="currentColor"/g, 'fill="#ffffff"')
    .replace(/stroke="currentColor"/g, 'stroke="#ffffff"')
    .replace(/^<svg/, `<svg x="${x}" y="${y}" width="${size}" height="${size}"`);
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
 * Register a pin sprite for each given feature type. Pass only the types that
 * actually render as point markers (linear features draw as lines and never
 * reference a sprite), so we don't rasterise unused pins. Idempotent (skips
 * images already present), so it can be re-run after a basemap/style switch
 * (a style change clears registered images). A single failing icon is skipped,
 * not fatal — that type falls back to its plain circle layer (e.g. an icon that
 * needs React context, like the chakra.svg tunnel glyph, degrades to a circle).
 */
export async function loadTypeIcons(
  map: MlMap,
  types: Iterable<string>
): Promise<void> {
  await Promise.all(
    Array.from(new Set(types)).map(async type => {
      const cfg = featureTypes[type as FeatureType];
      if (!cfg) return; // unknown type — no sprite to build
      const id = `${ICON_PREFIX}${type}`;
      if (map.hasImage(id)) return;
      try {
        const glyph = glyphFromIcon(cfg.icon as ComponentType<Record<string, unknown>>);
        const img = await svgToImage(wrapPin(TYPE_COLORS[type as FeatureType], glyph));
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: DPR });
      } catch {
        /* skip a single bad icon; the circle layer is the fallback */
      }
    })
  );
}

export type MarkerCombo = { group: string; shot: string; color: string };

// Per-shot glyph box overrides: drone (Phosphor) and ground (Maki viewpoint)
// have more internal padding than the FA solids, so give them a bigger box to
// read at a comparable size. Others fall back to GLYPH_SIZE.
const SHOT_GLYPH_SIZE: Record<string, number> = {
  drone: 26,
  ground: 26,
};

/**
 * Register a combined video-marker sprite per (colour group × shot type): a
 * coloured circle (the group's colour) with the shot-type's white glyph baked
 * in. Because each marker is then a SINGLE sprite, markers occlude each other
 * as whole units (a front marker hides the one behind), unlike a separate
 * circle+glyph layer pair. Pass only the combos that actually occur in the data
 * (group = a creator id or 'default') so we don't rasterise hundreds of unused
 * combinations on load. Idempotent; re-runnable after a style switch.
 */
export async function loadCombinedMarkerIcons(
  map: MlMap,
  combos: MarkerCombo[]
): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const { group, shot, color } of combos) {
    const id = `${COMBINED_PREFIX}${group}-${shot}`;
    if (map.hasImage(id)) continue;
    const icon = shotTypes[shot as ShotType]?.icon;
    if (!icon) continue;
    jobs.push(
      (async () => {
        try {
          const glyph = glyphFromIcon(
            icon as ComponentType<Record<string, unknown>>,
            SHOT_GLYPH_SIZE[shot] ?? GLYPH_SIZE
          );
          const img = await svgToImage(wrapPin(color, glyph));
          if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: DPR });
        } catch {
          /* skip a single bad combo */
        }
      })()
    );
  }
  await Promise.all(jobs);
}
