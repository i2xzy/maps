'use client';

import { Box, Button, Heading, VStack, HStack, Text } from '@chakra-ui/react';
import Link from 'next/link';

import {
  formatTimestamp,
  chaptersHaveVaryingFeatures,
  type Chapter,
} from '@/utils/media-grouping';
import { getFeatureHref } from '@/utils/feature-routing';
import { useVideoPlayer } from './video-player-context';

// Fixed timestamp-button width so every title lines up in one column, and the
// feature spacer below can match it.
const TIMESTAMP_WIDTH = '3.5rem';

export default function ChapterList({ chapters }: { chapters: Chapter[] }) {
  const { seekTo } = useVideoPlayer();

  if (chapters.length === 0) return null;

  // Only list features per chapter when they vary across the video. When every
  // chapter covers the same feature (e.g. one viaduct at several dates), the
  // feature link belongs once in the related-features list, not on every row.
  const showFeatures = chaptersHaveVaryingFeatures(chapters);

  // Show whichever field distinguishes the chapters. Same feature at different
  // dates (Colne Valley) -> date leads. Different places on one date (a flyover
  // shot in a day) -> place leads, with the shared date as context underneath.
  const datesVary = new Set(chapters.map(c => c.date).filter(Boolean)).size > 1;
  const placesVary =
    new Set(chapters.map(c => c.place).filter(Boolean)).size > 1;
  const placeLeads = placesVary || !datesVary;

  return (
    <VStack gap={3} align='stretch'>
      <Heading size='sm'>Chapters</Heading>
      {chapters.map((chapter, i) => {
        const primary = placeLeads
          ? chapter.place || chapter.date || `Chapter ${i + 1}`
          : chapter.date;
        // Show the date as a sub-line only when place is the lead and we have
        // both, so we never repeat the same string twice.
        const secondary =
          placeLeads && chapter.place && chapter.date ? chapter.date : '';

        return (
        <VStack key={`${chapter.seconds}-${i}`} gap={1} align='stretch'>
          <HStack gap={3} align='center'>
            <Button
              onClick={() => seekTo(chapter.seconds)}
              variant='outline'
              size='xs'
              minW={TIMESTAMP_WIDTH}
              flexShrink={0}
            >
              {formatTimestamp(chapter.seconds)}
            </Button>
            <VStack gap={0} align='start'>
              <Text fontWeight='medium' fontSize='sm'>
                {primary}
              </Text>
              {secondary && (
                <Text fontSize='xs' color='fg.muted'>
                  {secondary}
                </Text>
              )}
            </VStack>
          </HStack>
          {showFeatures && chapter.features.length > 0 && (
            <HStack gap={3} align='start'>
              <Box minW={TIMESTAMP_WIDTH} flexShrink={0} />
              <VStack gap={0} align='start'>
                {chapter.features.map(feature => (
                  <Link
                    key={feature.id}
                    href={getFeatureHref(feature.type, feature.id)}
                  >
                    <Text
                      fontSize='xs'
                      color='fg.muted'
                      _hover={{ color: 'fg' }}
                    >
                      {feature.name}
                    </Text>
                  </Link>
                ))}
              </VStack>
            </HStack>
          )}
        </VStack>
        );
      })}
    </VStack>
  );
}
