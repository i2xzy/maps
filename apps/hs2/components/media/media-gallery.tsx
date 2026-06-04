'use client';

import { useState } from 'react';
import {
  SimpleGrid,
  VStack,
  HStack,
  Text,
  Box,
  Avatar,
  Heading,
  Image,
  Button,
} from '@chakra-ui/react';
import Link from 'next/link';

import { formatDate } from '@ui/helpers/date-formatting';

interface Creator {
  id: string;
  display_name: string;
  profile_image_url: string | null;
}

interface MediaItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: string;
  shot_type: string;
  youtube_id: string | null;
  published_at: string | null;
  recorded_date: string | null;
  creators?: Creator | null;
}

type SortField = 'recorded' | 'published';

/** The date used both for sorting and for display, per the active field, with
 *  a fallback to the other date when the preferred one is missing. */
function activeDate(item: MediaItem, field: SortField): string | null {
  return field === 'published'
    ? item.published_at || item.recorded_date
    : item.recorded_date || item.published_at;
}

function sortTimestamp(item: MediaItem, field: SortField): number {
  const value = activeDate(item, field);
  return value ? new Date(value).getTime() : 0;
}

interface MediaGalleryProps {
  media: MediaItem[] | null;
  title?: string;
  isPage?: boolean;
  /**
   * Initial sort + displayed date. 'recorded' (default) for construction
   * chronology (feature/creator pages); 'published' for the news feed
   * ("what's new"). Users can toggle between the two.
   */
  defaultSort?: SortField;
}

export function MediaGallery({
  media,
  title,
  isPage = false,
  defaultSort = 'recorded',
}: MediaGalleryProps) {
  const [sort, setSort] = useState<SortField>(defaultSort);

  if (!media || media.length === 0) return null;

  const sorted = [...media].sort(
    (a, b) => sortTimestamp(b, sort) - sortTimestamp(a, sort)
  );

  // Sorting is only meaningful with more than one item.
  const showSort = media.length > 1;

  return (
    <VStack gap={4} align='stretch'>
      {(title || showSort) && (
        <HStack justify='space-between' align='center' wrap='wrap' gap={2}>
          {title ? (
            <Heading size='lg'>
              {title} ({media.length})
            </Heading>
          ) : (
            <Box />
          )}
          {showSort && (
            <HStack gap={2} align='center'>
              <Text fontSize='xs' color='fg.muted'>
                Sort by
              </Text>
              <HStack gap={1}>
                <Button
                  size='xs'
                  variant={sort === 'recorded' ? 'solid' : 'outline'}
                  onClick={() => setSort('recorded')}
                >
                  Recorded
                </Button>
                <Button
                  size='xs'
                  variant={sort === 'published' ? 'solid' : 'outline'}
                  onClick={() => setSort('published')}
                >
                  Published
                </Button>
              </HStack>
            </HStack>
          )}
        </HStack>
      )}
      <SimpleGrid columns={{ base: 1, sm: 2, md: isPage ? 4 : 3 }} gap={4}>
        {sorted.map(item => {
          const date = activeDate(item, sort);
          return (
            <Link key={item.id} href={`/media/${item.id}`}>
              <VStack gap={3} align='stretch'>
                <Box
                  position='relative'
                  aspectRatio={16 / 9}
                  overflow='hidden'
                  borderRadius='lg'
                >
                  {item.youtube_id ? (
                    <Image
                      src={`https://img.youtube.com/vi/${item.youtube_id}/0.jpg`}
                      alt={item.title}
                      boxSize='full'
                      objectFit='cover'
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt={item.title}
                      boxSize='full'
                      objectFit='cover'
                    />
                  )}
                </Box>

                <HStack gap={2} align='stretch'>
                  {item.creators?.profile_image_url && (
                    <Avatar.Root>
                      <Avatar.Fallback name={item.creators.display_name} />
                      <Avatar.Image src={item.creators.profile_image_url} />
                    </Avatar.Root>
                  )}
                  <VStack gap={1} align='stretch'>
                    {/* description holds the real YouTube title; title is the
                        curated date+feature label used as a fallback (images,
                        or rows with no description). */}
                    <Text fontWeight='bold' fontSize='sm' lineClamp={2}>
                      {item.description || item.title}
                    </Text>

                    <VStack gap={0} align='stretch'>
                      {item.creators && (
                        <Link href={`/creators/${item.creators.id}`}>
                          <Text
                            fontSize='xs'
                            color='fg.muted'
                            _hover={{ color: 'fg' }}
                          >
                            {item.creators.display_name}
                          </Text>
                        </Link>
                      )}
                      {date && (
                        <Text fontSize='xs' color='fg.muted'>
                          {formatDate(date)}
                        </Text>
                      )}
                    </VStack>
                  </VStack>
                </HStack>
              </VStack>
            </Link>
          );
        })}
      </SimpleGrid>
    </VStack>
  );
}
