'use client';

/**
 * Detail panel for a video picked on the map or in the Videos tab. Mirrors
 * FeatureDetailPanel: stay on the map, show the video's thumbnail/title/date,
 * a link to its full page, and the structures it covers (fetched client-side
 * across all of the video's markers via youtube_id).
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Stack,
  HStack,
  Heading,
  Text,
  Button,
  Image,
  Spinner,
  IconButton,
  Link as ChakraLink,
} from '@chakra-ui/react';
import Link from 'next/link';
import { LuX, LuExternalLink } from 'react-icons/lu';

import { createClient } from '@supabase/client';
import type { FeatureType } from '@supabase/types';
import { formatDate } from '@ui/helpers/date-formatting';
import { FeatureIcon } from '@/components/feature/feature-icon';
import { getFeatureHref } from '@/utils/feature-routing';
import { ShotTypeIcon, shotTypeLabel } from '@/components/map/shot-type-config';
import { thinScrollbar } from '@/components/map/panel-styles';

export type SelectedVideo = {
  id: string;
  youtubeId: string;
  title: string;
  recordedDate: string | null;
  publishedDate: string | null;
  shotType: string | null;
};

type LinkedFeature = { id: string; name: string; type: FeatureType };

export default function MediaDetailPanel({
  video,
  onClose,
}: {
  video: SelectedVideo | null;
  onClose: () => void;
}) {
  const [result, setResult] = useState<{
    forId: string;
    features: LinkedFeature[];
  } | null>(null);

  useEffect(() => {
    if (!video) return;
    let cancelled = false;

    const supabase = createClient();
    supabase
      .from('media')
      .select('media_features ( features ( id, name, type ) )')
      .eq('youtube_id', video.youtubeId)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as {
          media_features: { features: LinkedFeature | null }[] | null;
        }[];
        const seen = new Set<string>();
        const features: LinkedFeature[] = [];
        for (const row of rows) {
          for (const mf of row.media_features ?? []) {
            const f = mf.features;
            if (f && !seen.has(f.id)) {
              seen.add(f.id);
              features.push(f);
            }
          }
        }
        setResult({ forId: video.id, features });
      });

    return () => {
      cancelled = true;
    };
  }, [video]);

  if (!video) return null;

  const ready = result?.forId === video.id;
  const features = ready ? result.features : [];
  const thumb = `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;

  return (
    <Box
      position='absolute'
      top={3}
      right={3}
      w={{ base: 'calc(100% - 24px)', sm: '320px' }}
      maxH='calc(100% - 24px)'
      overflowY='auto'
      css={thinScrollbar}
      bg='bg.panel'
      borderWidth='1px'
      borderColor='border'
      borderRadius='lg'
      shadow='lg'
      p={4}
    >
      <Stack gap={3}>
        <HStack justify='space-between' align='start'>
          <Heading size='sm' lineClamp={2}>
            {video.title}
          </Heading>
          <IconButton aria-label='Close' size='xs' variant='ghost' onClick={onClose}>
            <LuX />
          </IconButton>
        </HStack>

        <ChakraLink asChild borderRadius='md' overflow='hidden' _hover={{ opacity: 0.9 }}>
          <Link href={`/media/${video.id}`}>
            <Image src={thumb} alt={video.title} aspectRatio={16 / 9} objectFit='cover' w='full' />
          </Link>
        </ChakraLink>

        <HStack gap={3} color='fg.muted' fontSize='sm'>
          {video.recordedDate ? (
            <Text>Recorded {formatDate(video.recordedDate)}</Text>
          ) : video.publishedDate ? (
            <Text>Published {formatDate(video.publishedDate)}</Text>
          ) : null}
          {video.shotType && (
            <HStack gap={1}>
              <ShotTypeIcon shotType={video.shotType} color='fg.muted' />
              <Text>{shotTypeLabel(video.shotType)}</Text>
            </HStack>
          )}
        </HStack>

        <Button asChild size='sm' variant='outline'>
          <Link href={`/media/${video.id}`}>
            Open video page <LuExternalLink />
          </Link>
        </Button>

        <Box>
          <Text fontSize='xs' fontWeight='semibold' color='fg.muted' textTransform='uppercase' mb={2}>
            Structures in this video
          </Text>
          {!ready ? (
            <HStack justify='center' py={4}>
              <Spinner size='sm' />
            </HStack>
          ) : features.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>
              No linked structures.
            </Text>
          ) : (
            <Stack gap={0}>
              {features.map(f => (
                <ChakraLink key={f.id} asChild _hover={{ bg: 'bg.muted' }} borderRadius='md'>
                  <Link href={getFeatureHref(f.type, f.id)}>
                    <HStack gap={2} px={2} py={1.5}>
                      <FeatureIcon type={f.type} name={f.name} />
                      <Text fontSize='sm' lineClamp={1}>
                        {f.name}
                      </Text>
                    </HStack>
                  </Link>
                </ChakraLink>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
