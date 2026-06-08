'use client';

import { useState } from 'react';
import {
  Heading,
  VStack,
  HStack,
  Text,
  Card,
  IconButton,
} from '@chakra-ui/react';
import Link from 'next/link';
import { LuArrowDown01, LuArrowDown10 } from 'react-icons/lu';

import { FeatureStatus, FeatureType } from '@supabase/types';

type Feature = {
  id: string;
  name: string;
  type: FeatureType;
  status: FeatureStatus | null;
  chainage: number | null;
  chainage_end: number | null;
};

import { getFeatureHref } from '@/utils/feature-routing';
import { Tooltip } from '@ui/components/tooltip';
import { FeatureIcon } from '@/components/feature/feature-icon';

export default function MediaFeatures({
  relatedFeatures,
}: {
  relatedFeatures: Feature[];
}) {
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');

  // South -> north: sort by each feature's start (chainage). North -> south:
  // sort by its north end (chainage_end) so a linear feature (cutting,
  // embankment) appears at the point it actually ends, not its south start.
  // Points have no chainage_end, so fall back to chainage.
  const sorted = [...relatedFeatures].sort((a, b) =>
    sort === 'asc'
      ? (a.chainage ?? 0) - (b.chainage ?? 0)
      : (b.chainage_end ?? b.chainage ?? 0) - (a.chainage_end ?? a.chainage ?? 0)
  );

  return (
    <VStack gap={4} align='stretch'>
      <HStack justify='space-between'>
        <Heading size='lg'>
          Featured Structures ({relatedFeatures.length})
        </Heading>
        {relatedFeatures.length > 1 && (
          <Tooltip
            content={`Sort from ${sort === 'asc' ? 'south to north' : 'north to south'}`}
          >
            <IconButton
              variant='ghost'
              aria-label='Sort by N/S direction'
              onClick={() => setSort(sort === 'asc' ? 'desc' : 'asc')}
            >
              {sort === 'asc' ? <LuArrowDown01 /> : <LuArrowDown10 />}
            </IconButton>
          </Tooltip>
        )}
      </HStack>

      <VStack gap={4} align='stretch'>
        {sorted.map(feature => (
          <Link
            key={feature.id}
            href={getFeatureHref(feature.type, feature.id)}
          >
            <Card.Root>
              <Card.Body p={4}>
                <HStack gap={4}>
                  <FeatureIcon {...feature} />
                  <Text fontWeight='semibold' fontSize='sm' color='blue.400'>
                    {feature.name}
                  </Text>
                </HStack>
              </Card.Body>
            </Card.Root>
          </Link>
        ))}
      </VStack>
    </VStack>
  );
}
