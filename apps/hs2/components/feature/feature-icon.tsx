'use client';

import { Icon } from '@chakra-ui/react';
import { FaPersonWalking } from 'react-icons/fa6';

import { FeatureType } from '@supabase/types';
import { featureTypes } from './config';

interface FeatureIconProps {
  type: FeatureType;
  name?: string;
}

export const FeatureIcon = ({ type, name }: FeatureIconProps) => {
  const { icon, iconProps, color } = featureTypes[type];
  if (name?.includes('Footpath'))
    return <Icon color={color} as={FaPersonWalking} size='lg' />;
  return <Icon color={color} as={icon} {...iconProps} size='md' />;
};
