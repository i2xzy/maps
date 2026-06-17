'use client';

/**
 * Corner basemap switcher (Google-Maps style): a small thumbnail showing the
 * *other* basemap with a label. One click flips it. Lives in a map corner,
 * out of the control panel, since it's used rarely.
 *
 * Thumbnails are single static tiles over London (z10) from each provider —
 * Esri imagery for satellite, OSM raster for the street map.
 */
import { Box, Text } from '@chakra-ui/react';

type Basemap = 'streets' | 'satellite';

const THUMB: Record<Basemap, string> = {
  streets: 'https://tile.openstreetmap.org/10/511/341.png',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/341/511',
};
const LABEL: Record<Basemap, string> = {
  streets: 'Map',
  satellite: 'Satellite',
};

export default function BasemapToggle({
  basemap,
  onChange,
  left,
}: {
  basemap: Basemap;
  onChange: (b: Basemap) => void;
  /** Left inset so the thumbnail clears the control panel. */
  left: { base: string; sm: string };
}) {
  const next: Basemap = basemap === 'satellite' ? 'streets' : 'satellite';

  return (
    <Box
      as='button'
      position='absolute'
      bottom={3}
      left={left}
      w='76px'
      h='76px'
      borderRadius='lg'
      overflow='hidden'
      borderWidth='2px'
      borderColor='bg.panel'
      shadow='lg'
      bgImage={`url(${THUMB[next]})`}
      bgSize='cover'
      backgroundPosition='center'
      onClick={() => onChange(next)}
      aria-label={`Switch to ${LABEL[next]} view`}
      transition='border-color 0.15s'
      _hover={{ borderColor: 'blue.400' }}
    >
      <Box
        position='absolute'
        bottom={0}
        insetX={0}
        bg='blackAlpha.700'
        py={0.5}
      >
        <Text fontSize='2xs' fontWeight='semibold' color='white' textAlign='center'>
          {LABEL[next]}
        </Text>
      </Box>
    </Box>
  );
}
