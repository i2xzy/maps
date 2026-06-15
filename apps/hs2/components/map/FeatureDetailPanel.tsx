'use client';

/**
 * Detail panel shown when a feature is clicked on the map (Google My Maps
 * style — stay on the map, surface the structure's info + its media inline,
 * with a link out to the full page). Related media is fetched client-side on
 * selection via the browser Supabase client.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Stack,
  HStack,
  Heading,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Image,
  Spinner,
  IconButton,
  Link as ChakraLink,
} from '@chakra-ui/react';
import Link from 'next/link';
import { LuX, LuExternalLink } from 'react-icons/lu';

import { createClient } from '@supabase/client';
import type { FeatureType, FeatureStatus } from '@supabase/types';
import { featureTypes, featureStatuses } from '@/components/feature/config';
import { FeatureIcon } from '@/components/feature/feature-icon';
import { getFeatureHref } from '@/utils/feature-routing';
import { thinScrollbar } from '@/components/map/panel-styles';

export type SelectedFeature = {
  id: string;
  name: string;
  type: FeatureType;
  status: FeatureStatus | null;
  chainage: number | null;
};

type RelatedMedia = {
  id: string;
  title: string | null;
  type: string | null;
  youtube_id: string | null;
  url: string | null;
};

function thumbnail(m: RelatedMedia): string | null {
  if (m.youtube_id) return `https://img.youtube.com/vi/${m.youtube_id}/mqdefault.jpg`;
  if (m.type === 'image' && m.url) return m.url;
  return null;
}

export default function FeatureDetailPanel({
  feature,
  onClose,
}: {
  feature: SelectedFeature | null;
  onClose: () => void;
}) {
  // Keyed by feature id so `loading` can be derived (no setState in the effect
  // body — only inside the async resolution).
  const [result, setResult] = useState<{
    forId: string;
    media: RelatedMedia[];
  } | null>(null);

  useEffect(() => {
    if (!feature) return;
    let cancelled = false;

    const supabase = createClient();
    supabase
      .from('media_features')
      .select('media ( id, title, type, youtube_id, url )')
      .eq('feature_id', feature.id)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as { media: RelatedMedia | null }[];
        const seen = new Set<string>();
        const list: RelatedMedia[] = [];
        for (const row of rows) {
          const m = row.media;
          if (m && !seen.has(m.id)) {
            seen.add(m.id);
            list.push(m);
          }
        }
        setResult({ forId: feature.id, media: list });
      });

    return () => {
      cancelled = true;
    };
  }, [feature]);

  if (!feature) return null;

  const ready = result?.forId === feature.id;
  const loading = !ready;
  const media = ready ? result.media : [];

  const status = feature.status;
  const statusConfig = status ? featureStatuses[status] : null;

  return (
    <Card.Root
      position='absolute'
      top={3}
      right={3}
      w={{ base: 'calc(100% - 24px)', sm: '320px' }}
      maxH='calc(100% - 24px)'
      overflowY='auto'
      css={thinScrollbar}
      variant='elevated'
      borderRadius='lg'
      p={4}
    >
      <Stack gap={3}>
        <HStack justify='space-between' align='start'>
          <HStack gap={2}>
            <FeatureIcon type={feature.type} name={feature.name} />
            <Heading size='sm' lineClamp={2}>
              {feature.name}
            </Heading>
          </HStack>
          <IconButton aria-label='Close' size='xs' variant='ghost' onClick={onClose}>
            <LuX />
          </IconButton>
        </HStack>

        <HStack gap={2} wrap='wrap'>
          <Badge>{featureTypes[feature.type].label}</Badge>
          {statusConfig && (
            <Badge colorPalette={statusConfig.colorPalette}>{statusConfig.label}</Badge>
          )}
        </HStack>

        {feature.chainage != null && (
          <Text fontSize='sm' color='fg.muted'>
            Chainage {(feature.chainage / 1000).toFixed(1)} km
          </Text>
        )}

        <Button asChild size='sm' variant='outline'>
          <Link href={getFeatureHref(feature.type, feature.id)}>
            Open full page <LuExternalLink />
          </Link>
        </Button>

        <Box>
          <Text fontSize='xs' fontWeight='semibold' color='fg.muted' textTransform='uppercase' mb={2}>
            Photos &amp; videos
          </Text>
          {loading ? (
            <HStack justify='center' py={4}>
              <Spinner size='sm' />
            </HStack>
          ) : media.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>
              No media linked yet.
            </Text>
          ) : (
            <SimpleGrid columns={2} gap={2}>
              {media.map(m => {
                const thumb = thumbnail(m);
                return (
                  <ChakraLink
                    key={m.id}
                    asChild
                    borderRadius='md'
                    overflow='hidden'
                    _hover={{ opacity: 0.85 }}
                  >
                    <Link href={`/media/${m.id}`}>
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={m.title ?? 'Media'}
                          aspectRatio={16 / 9}
                          objectFit='cover'
                          w='full'
                        />
                      ) : (
                        <Box
                          aspectRatio={16 / 9}
                          bg='bg.muted'
                          p={2}
                          fontSize='xs'
                          lineClamp={3}
                        >
                          {m.title}
                        </Box>
                      )}
                    </Link>
                  </ChakraLink>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
      </Stack>
    </Card.Root>
  );
}
