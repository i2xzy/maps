import { Icon } from '@chakra-ui/react';
import {
  FaBridge,
  FaBridgeWater,
  FaCarTunnel,
  FaPersonWalking,
  FaRoadBridge,
  FaWind,
} from 'react-icons/fa6';
import { SiNationalrail } from 'react-icons/si';

import { FeatureSearchResult } from '@supabase/types';
import { RailTunnel } from './icons/rail-tunnel';

export const FeatureIcon = ({ feature }: { feature: FeatureSearchResult }) => {
  if (feature.type === 'overbridge')
    return <Icon color='yellow.600' as={FaRoadBridge} />;
  if (feature.type === 'underbridge')
    return <Icon color='red.600' as={FaBridge} />;
  if (feature.type === 'underpass' && feature.name.includes('Footpath'))
    return <Icon color='red.600' as={FaPersonWalking} />;
  if (feature.type === 'underpass')
    return <Icon color='red.600' as={FaCarTunnel} />;
  if (
    feature.type === 'viaduct' ||
    feature.type === 'box_structure' ||
    feature.type === 'culvert'
  )
    return (
      <Icon
        color={feature.type === 'culvert' ? 'blue.500' : 'purple.500'}
        as={FaBridgeWater}
      />
    );
  if (feature.type === 'tunnel' || feature.type === 'cut_and_cover')
    return (
      <Icon
        as={RailTunnel}
        color={feature.type === 'cut_and_cover' ? 'green.600' : 'gray.700'}
      />
    );
  if (feature.type === 'shaft') return <Icon color='gray.500' as={FaWind} />;
  if (feature.type === 'station') return <Icon as={SiNationalrail} />;
  return null;
};
