'use client';

import { Button, Heading, VStack, HStack, Text } from '@chakra-ui/react';
import Link from 'next/link';

import {
  formatTimestamp,
  chaptersHaveVaryingFeatures,
  type Chapter,
} from '@/utils/media-grouping';
import { getFeatureHref } from '@/utils/feature-routing';
import { useVideoPlayer } from './video-player-context';

export default function ChapterList({ chapters }: { chapters: Chapter[] }) {
  const { seekTo } = useVideoPlayer();

  if (chapters.length === 0) return null;

  // Only list features per chapter when they vary across the video. When every
  // chapter covers the same feature (e.g. one viaduct at several dates), the
  // feature link belongs once in the related-features list, not on every row.
  const showFeatures = chaptersHaveVaryingFeatures(chapters);

  return (
    <VStack gap={3} align='stretch'>
      <Heading size='sm'>Chapters</Heading>
      {chapters.map((chapter, i) => (
        <HStack key={`${chapter.seconds}-${i}`} gap={3} align='start'>
          <Button
            onClick={() => seekTo(chapter.seconds)}
            variant='outline'
            size='xs'
            flexShrink={0}
          >
            {formatTimestamp(chapter.seconds)}
          </Button>
          <VStack gap={0} align='start'>
            <Text fontWeight='medium' fontSize='sm'>
              {chapter.date || `Chapter ${i + 1}`}
            </Text>
            {showFeatures &&
              chapter.features.map(feature => (
                <Link
                  key={feature.id}
                  href={getFeatureHref(feature.type, feature.id)}
                >
                  <Text fontSize='xs' color='fg.muted' _hover={{ color: 'fg' }}>
                    {feature.name}
                  </Text>
                </Link>
              ))}
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
}
