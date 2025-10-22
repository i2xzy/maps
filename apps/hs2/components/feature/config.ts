import { IconProps } from '@chakra-ui/react';
import {
  FaBridge,
  FaBridgeWater,
  FaCarTunnel,
  FaMound,
  FaRoadBridge,
  FaWind,
} from 'react-icons/fa6';
import { SiNationalrail } from 'react-icons/si';
import type { IconType } from 'react-icons';
import { FeatureType, FeatureStatus } from '@supabase/types';
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
    icon: FaMound,
    iconProps: { rotate: '180deg' },
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

// Map feature statuses to display names and colors
export const featureStatuses: Record<
  NonNullable<FeatureStatus>,
  { label: string; colorPalette: string; color: string; labelShort?: string }
> = {
  NOT_STARTED: { label: 'Not Started', colorPalette: 'red', color: 'red.600' },
  PREP_WORK: { label: 'Prep Work', colorPalette: 'red', color: 'red.500' },
  FOUNDATIONS: {
    label: 'Foundations',
    colorPalette: 'yellow',
    color: 'yellow.600',
  },
  DIGGING: { label: 'Digging', colorPalette: 'yellow', color: 'yellow.500' },
  SEGMENT_INSTALLATION: {
    label: 'Segment Installation',
    labelShort: 'Segments',
    colorPalette: 'blue',
    color: 'blue.500',
  },
  PIERS: { label: 'Piers', colorPalette: 'blue', color: 'yellow.500' },
  SIDE_TUNNELS: {
    label: 'Side Tunnels',
    colorPalette: 'blue',
    color: 'blue.500',
  },
  DECK: { label: 'Deck', colorPalette: 'blue', color: 'blue.500' },
  PARAPET: { label: 'Parapet', colorPalette: 'blue', color: 'blue.600' },
  SURFACE_BUILDINGS: {
    label: 'Surface Buildings',
    // labelShort: 'Buildings',
    colorPalette: 'blue',
    color: 'blue.600',
  },
  LANDSCAPING: {
    label: 'Landscaping',
    colorPalette: 'green',
    color: 'green.500',
  },
  CIVILS: { label: 'Civils', colorPalette: 'green', color: 'green.500' },
  COMPLETED: { label: 'Completed', colorPalette: 'green', color: 'green.600' },
};
