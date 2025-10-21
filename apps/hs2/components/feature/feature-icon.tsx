'use client';

import { Icon } from '@chakra-ui/react';
import { FaPersonWalking } from 'react-icons/fa6';

import { FeatureSearchResult } from '@supabase/types';
import { featureTypes } from './config';

export const FeatureIcon = ({ feature }: { feature: FeatureSearchResult }) => {
  const { icon, iconProps, color } = featureTypes[feature.type];
  if (feature.name.includes('Footpath'))
    return <Icon color={color} as={FaPersonWalking} />;
  return <Icon color={color} as={icon} {...iconProps} />;
};
