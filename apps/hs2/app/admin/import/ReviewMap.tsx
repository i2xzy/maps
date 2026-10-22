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
import { asGeometry } from '@/utils/map-geojson';
import { geometryBounds } from '@/utils/map-preview';

import type { FeatureGeometry } from './actions';
import type { DrawFeature } from './ReviewMapInner';
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
  features: FeatureGeometry[];
};

export function ReviewMap({ geometry, shotType, features }: Props) {
  const pin = geometry ? importGeometryToGeoJSON(geometry) : null;
  const pinHasBounds = pin ? Boolean(geometryBounds(pin)) : false;

  const drawFeatures: DrawFeature[] = features.flatMap((f) => {
    const g = asGeometry(f.geojson);
    return g && geometryBounds(g) ? [{ id: f.id, name: f.name, type: f.type, geometry: g }] : [];
  });

  // Nothing to draw (no pin location and no mappable features) → placeholder.
  if (!pinHasBounds && drawFeatures.length === 0) {
    return (
      <FallbackBox>
        <HStack gap={2} color='fg.muted'>
          <Icon>
            <LuMapPinned />
          </Icon>
          <Text fontSize='sm'>No location to show yet</Text>
        </HStack>
      </FallbackBox>
    );
  }

  return (
    <ReviewMapInner pin={pinHasBounds ? pin : null} shotType={shotType} features={drawFeatures} />
  );
}
