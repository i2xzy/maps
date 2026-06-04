import {
  SimpleGrid,
  VStack,
  HStack,
  Text,
  AspectRatio,
  Avatar,
  Heading,
  Image,
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

interface MediaGalleryProps {
  media: MediaItem[] | null;
  title?: string;
  isPage?: boolean;
  /**
   * Which date to show on each card. 'recorded' (default) prefers the filmed
   * date — right for construction chronology. 'published' prefers the upload
   * date — right for the news feed ("what's new").
   */
  dateField?: 'recorded' | 'published';
}

export function MediaGallery({
  media,
  title,
  isPage = false,
  dateField = 'recorded',
}: MediaGalleryProps) {
  if (!media || media.length === 0) return null;

  return (
    <VStack gap={4} align='stretch'>
      {title && (
        <Heading size='lg'>
          {title} ({media.length})
        </Heading>
      )}
      <SimpleGrid columns={{ base: 1, sm: 2, md: isPage ? 4 : 3 }} gap={4}>
        {media.map(item => (
          <Link key={item.id} href={`/media/${item.id}`}>
            <VStack gap={3} align='stretch'>
              <AspectRatio ratio={16 / 9}>
                {item.youtube_id ? (
                  <Image
                    src={`https://img.youtube.com/vi/${item.youtube_id}/0.jpg`}
                    alt={item.title}
                    borderRadius='lg'
                  />
                ) : (
                  <Image src={item.url} alt={item.title} borderRadius='lg' />
                )}
              </AspectRatio>

              <HStack gap={2} align='stretch'>
                {item.creators?.profile_image_url && (
                  <Avatar.Root>
                    <Avatar.Fallback name={item.creators.display_name} />
                    <Avatar.Image src={item.creators.profile_image_url} />
                  </Avatar.Root>
                )}
                <VStack gap={1} align='stretch'>
                  {/* description holds the real YouTube title; title is the
                      curated date+feature label used as a fallback (images, or
                      rows with no description). */}
                  <Text fontWeight='bold' fontSize='sm' lineClamp={2}>
                    {item.description || item.title}
                  </Text>

                  <VStack gap={0} align='stretch' as='object'>
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
                    {(() => {
                      const date =
                        dateField === 'published'
                          ? item.published_at || item.recorded_date
                          : item.recorded_date || item.published_at;
                      return (
                        date && (
                          <Text fontSize='xs' color='fg.muted'>
                            {formatDate(date)}
                          </Text>
                        )
                      );
                    })()}
                  </VStack>
                </VStack>
              </HStack>
            </VStack>
          </Link>
        ))}
      </SimpleGrid>
    </VStack>
  );
}
