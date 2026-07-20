'use client';

/**
 * Client boundary for the feature "Location" mini-map. MapLibre must not run
 * server-side, and `next/dynamic({ ssr:false })` is only allowed in a Client
 * Component — so this thin wrapper is what the server page renders. It also
 * decides the no-geometry fallback without pulling in MapLibre at all.
 */
import dynamic from 'next/dynamic';
import { Box, HStack, Text, Icon } from '@chakra-ui/react';
import { LuMapPinned } from 'react-icons/lu';

import type { FeatureType } from '@supabase/types';
import { geometryBounds } from '@/utils/map-preview';

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

const FeatureMiniMap = dynamic(() => import('./mini-map'), {
  ssr: false,
  loading: () => <FallbackBox>{null}</FallbackBox>,
});

type Props = {
  featureId: string;
  featureName: string;
  featureType: FeatureType;
  /** Parsed GeoJSON from the `features_geo` view, or null when unmapped. */
  geojson: unknown;
};

export function FeatureMapPreview(props: Props) {
  // No usable geometry → labelled placeholder, no map.
  if (!geometryBounds(props.geojson)) {
    return (
      <FallbackBox>
        <HStack gap={2} color='fg.muted'>
          <Icon>
            <LuMapPinned />
          </Icon>
          <Text fontSize='sm'>Location not yet mapped</Text>
        </HStack>
      </FallbackBox>
    );
  }

  return <FeatureMiniMap {...props} />;
}
