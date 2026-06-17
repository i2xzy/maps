'use client';

import { Icon } from '@chakra-ui/react';
import type { IconType } from 'react-icons';
import { FaPersonWalking } from 'react-icons/fa6';

import { FeatureType } from '@supabase/types';
import { featureTypes } from './config';

/**
 * The glyph (and any per-type icon props) for a feature, including the Footpath
 * special case. Shared by FeatureIcon and the map marker disc so they pick the
 * same icon.
 */
export function featureGlyph(type: FeatureType, name?: string) {
  if (name?.includes('Footpath'))
    return { icon: FaPersonWalking as IconType, iconProps: undefined };
  const { icon, iconProps } = featureTypes[type];
  return { icon, iconProps };
}

interface FeatureIconProps {
  type: FeatureType;
  name?: string;
}

export const FeatureIcon = ({ type, name }: FeatureIconProps) => {
  const { color } = featureTypes[type];
  const { icon, iconProps } = featureGlyph(type, name);
  const size = name?.includes('Footpath') ? 'lg' : 'md';
  return <Icon color={color} as={icon} {...iconProps} size={size} />;
};
