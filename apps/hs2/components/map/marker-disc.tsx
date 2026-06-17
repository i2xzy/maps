'use client';

/**
 * Marker-style discs for the search results and side-panel lists: the entity's
 * colour with a white glyph, mirroring the map markers so the lists read as the
 * same things you see on the map.
 */
import { Circle, Icon } from '@chakra-ui/react';

import type { FeatureType } from '@supabase/types';
import { featureGlyph } from '@/components/feature/feature-icon';
import { TYPE_COLORS } from './map-colors';
import { ShotTypeIcon } from './shot-type-config';

// Explicit glyph size (not inherited font-size) so the disc renders the same
// in the side panel and the search dropdown, which sit in different font
// contexts.
const DISC_GLYPH_SIZE = '12px';

const discStyle = (bg: string, size: string) => ({
  size,
  bg,
  color: 'white' as const,
  flexShrink: 0,
});

/** Feature marker: type-colour disc with the type's white glyph. */
export function FeatureDisc({
  type,
  name,
  size = '20px',
}: {
  type: FeatureType;
  name?: string;
  size?: string;
}) {
  const { icon, iconProps } = featureGlyph(type, name);
  return (
    <Circle {...discStyle(TYPE_COLORS[type], size)}>
      <Icon as={icon} {...(iconProps ?? {})} boxSize={DISC_GLYPH_SIZE} />
    </Circle>
  );
}

/** Video marker: creator-colour disc with the shot-type's white glyph. */
export function VideoDisc({
  shotType,
  color,
  size = '20px',
}: {
  shotType: string | null;
  color: string;
  size?: string;
}) {
  return (
    <Circle {...discStyle(color, size)}>
      <ShotTypeIcon shotType={shotType} color='white' boxSize={DISC_GLYPH_SIZE} />
    </Circle>
  );
}
