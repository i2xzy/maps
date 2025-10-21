import { IconProps } from '@chakra-ui/react';
import {
  FaBorderTopLeft,
  FaBridge,
  FaBridgeWater,
  FaCarTunnel,
  FaMound,
  FaRoadBridge,
  FaWind,
} from 'react-icons/fa6';
import { SiNationalrail } from 'react-icons/si';
import type { IconType } from 'react-icons';
import { FeatureType } from '@supabase/types';
import { RailTunnel } from '../icons/rail-tunnel';

type FeatureTypeConfig = {
  label: string;
  color: string;
  icon: IconType | ((props: IconProps) => React.ReactNode);
  iconProps?: IconProps;
};

export const featureTypes: Record<FeatureType, FeatureTypeConfig> = {
  overbridge: {
    label: 'Overbridge',
    color: 'yellow.600',
    icon: FaRoadBridge,
  },
  underbridge: {
    label: 'Underbridge',
    color: 'red.600',
    icon: FaBridge,
  },
  underpass: {
    label: 'Underpass',
    color: 'red.600',
    icon: FaCarTunnel,
  },
  viaduct: {
    label: 'Viaduct',
    color: 'purple.500',
    icon: FaBridgeWater,
  },
  box_structure: {
    label: 'Box Structure',
    color: 'purple.500',
    icon: FaBridgeWater,
  },
  tunnel: {
    label: 'Tunnel',
    color: 'gray.700',
    icon: RailTunnel,
  },
  cut_and_cover: {
    label: 'Cut and Cover',
    color: 'green.600',
    icon: RailTunnel,
  },
  embankment: {
    label: 'Embankment',
    color: 'brown.500',
    icon: FaMound,
  },
  cutting: {
    label: 'Cutting',
    color: 'orange.500',
    icon: FaBorderTopLeft,
    iconProps: { rotate: '45deg' },
  },
  shaft: {
    label: 'Shaft',
    color: 'gray.500',
    icon: FaWind,
  },
  station: {
    label: 'Station',
    color: 'fg',
    icon: SiNationalrail,
  },
  culvert: {
    label: 'Culvert',
    color: 'blue.500',
    icon: FaBridgeWater,
  },
};
