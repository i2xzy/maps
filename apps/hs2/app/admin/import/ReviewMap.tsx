'use client';

/**
 * Client boundary for the review pin's mini-map. MapLibre must not run
 * server-side, and `next/dynamic({ ssr:false })` is only allowed in a Client
 * Component — so this thin wrapper is what renders, and it decides the
 * no-geometry fallback without pulling in MapLibre at all. Mirrors
 * components/feature/map-preview.tsx.
 */
import dynamic from 'next/dynamic';
import { Box, HStack, Text, Icon } from '@chakra-ui/react';
import { LuMapPinned } from 'react-icons/lu';

import type { Geometry } from '@/lib/import';
import { geometryBounds } from '@/utils/map-preview';

import { importGeometryToGeoJSON } from './review-geometry';

const ASPECT = 5 / 3;

const FallbackBox = ({ children }: { children: React.ReactNode }) => (
  <Box
    aspectRatio={ASPECT}
    width='100%'
    borderRadius='md'
    borderWidth='1px'
    borderColor='border'
    bg='bg.subtle'
    display='flex'
    alignItems='center'
    justifyContent='center'
  >
    {children}
  </Box>
);

const ReviewMapInner = dynamic(() => import('./ReviewMapInner'), {
  ssr: false,
  loading: () => <FallbackBox>{null}</FallbackBox>,
});

type Props = {
  geometry: Geometry | null;
  shotType: string | null;
};

export function ReviewMap({ geometry, shotType }: Props) {
  const geojson = geometry ? importGeometryToGeoJSON(geometry) : null;

  // No usable geometry → labelled placeholder, no map.
  if (!geojson || !geometryBounds(geojson)) {
    return (
      <FallbackBox>
        <HStack gap={2} color='fg.muted'>
          <Icon>
            <LuMapPinned />
          </Icon>
          <Text fontSize='sm'>No location pin for this video</Text>
        </HStack>
      </FallbackBox>
    );
  }

  return <ReviewMapInner geometry={geojson} shotType={shotType} />;
}
