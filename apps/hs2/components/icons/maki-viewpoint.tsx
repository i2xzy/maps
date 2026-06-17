import { GenIcon } from 'react-icons/lib';
import type { IconType } from 'react-icons';

/**
 * Maki "viewpoint" icon (binoculars on a stand) — from Mapbox's Maki set, which
 * is CC0 (https://github.com/mapbox/maki). Built via react-icons' GenIcon so it
 * renders the same markup as the Lucide/Tabler icons: it works in Chakra's
 * Icon-as and in the map's marker-sprite pipeline (glyphFromIcon) with no
 * special case.
 */
export const MakiViewpoint: IconType = GenIcon({
  tag: 'svg',
  // Cropped to the artwork's bounding box (~1 unit of horizontal and ~2.2 of
  // vertical padding in Maki's 15x15 grid) + a small even margin, so the glyph
  // fills the marker pin instead of rendering small and skinny.
  attr: { viewBox: '0.5 1.7 14 11.8' },
  child: [
    {
      tag: 'path',
      attr: {
        d: 'M6.02,8.425a2.3859,2.3859,0,0,0-.46.44l-4.55-3.5a7.9976,7.9976,0,0,1,1.51-1.51Zm6.46-4.56-3.5,4.55a2.3971,2.3971,0,0,1,.45.45l4.56-3.5A7.945,7.945,0,0,0,12.48,3.865ZM7.3042,10.0129a1.5,1.5,0,1,0,1.6829,1.2914h0A1.5,1.5,0,0,0,7.3042,10.0129ZM6.43,2.235a7.9329,7.9329,0,0,0-2.06.55l2.2,5.32a2.0438,2.0438,0,0,1,.61-.17Zm2.14.01-.75,5.69a2.49,2.49,0,0,1,.61.16l2.2-5.3A7.2129,7.2129,0,0,0,8.57,2.245Z',
      },
      child: [],
    },
  ],
});
