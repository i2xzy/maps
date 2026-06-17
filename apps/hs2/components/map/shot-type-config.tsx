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
  FaCar,
  FaPlane,
  FaTowerObservation,
  FaVideo,
  FaPenRuler,
} from 'react-icons/fa6';
import { PiDroneBold } from 'react-icons/pi';
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
  drone: { label: 'Drone', icon: PiDroneBold },
  ground: { label: 'Ground', icon: MakiViewpoint },
  vehicle: { label: 'Vehicle', icon: FaCar },
  aircraft: { label: 'Aircraft', icon: FaPlane },
  elevated: { label: 'Elevated', icon: FaTowerObservation },
  mixed: { label: 'Mixed', icon: FaVideo },
  illustration: { label: 'Illustration', icon: FaPenRuler },
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
