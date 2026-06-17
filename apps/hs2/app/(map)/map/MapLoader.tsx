'use client';

/**
 * Client boundary for the map. `next/dynamic({ ssr:false })` is only allowed
 * inside a Client Component, so this thin wrapper is what lets the server page
 * pull in MapView without MapLibre ever executing server-side (the SSR-crash
 * class from the Next 16 upgrade). MapView and maplibre-gl load only here.
 */
import dynamic from 'next/dynamic';
import { Center, Spinner } from '@chakra-ui/react';

import type { GeoRow } from '@/utils/map-geojson';
import type { Creator } from './MapView';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <Center position='absolute' inset={0}>
      <Spinner size='lg' />
    </Center>
  ),
});

export default function MapLoader(props: {
  features: GeoRow[];
  media: GeoRow[];
  creators: Creator[];
  dataError?: boolean;
}) {
  return <MapView {...props} />;
}
