'use client';

/**
 * Shot-type vocabulary for media: maps each `media.shot_type` enum value to a
 * label and an icon. Used by the Videos tab list, the media detail panel, and
 * the map marker sprites (so a drone clip, a ground clip, a vehicle pass, etc.
 * read differently instead of all being identical dots).
 */
import { Icon } from '@chakra-ui/react';
import type { IconType } from 'react-icons';
import {
  LuVideo,
  LuCar,
  LuPlane,
  LuTowerControl,
  LuPencilRuler,
} from 'react-icons/lu';
import { TbDrone } from 'react-icons/tb';
import { MakiViewpoint } from '@/components/icons/maki-viewpoint';

export type ShotType =
  | 'drone'
  | 'ground'
  | 'vehicle'
  | 'aircraft'
  | 'elevated'
  | 'mixed'
  | 'illustration';

export const shotTypes: Record<ShotType, { label: string; icon: IconType }> = {
  drone: { label: 'Drone', icon: TbDrone },
  ground: { label: 'Ground', icon: MakiViewpoint },
  vehicle: { label: 'Vehicle', icon: LuCar },
  aircraft: { label: 'Aircraft', icon: LuPlane },
  elevated: { label: 'Elevated', icon: LuTowerControl },
  mixed: { label: 'Mixed', icon: LuVideo },
  illustration: { label: 'Illustration', icon: LuPencilRuler },
};

const FALLBACK = shotTypes.mixed;

export const ShotTypeIcon = ({
  shotType,
  color = 'cyan.500',
}: {
  shotType: string | null | undefined;
  color?: string;
}) => {
  const cfg = shotTypes[shotType as ShotType] ?? FALLBACK;
  return <Icon as={cfg.icon} color={color} />;
};

export const shotTypeLabel = (shotType: string | null | undefined): string =>
  (shotTypes[shotType as ShotType] ?? FALLBACK).label;
