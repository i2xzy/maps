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
  creators: Creator | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
  title?: string;
  isPage?: boolean;
}

export function MediaGallery({
  media,
  title = 'Related Media',
  isPage = false,
}: MediaGalleryProps) {
  if (media.length === 0) return null;

  return (
    <VStack gap={4} align='stretch'>
      <Heading size='lg'>
        {title} ({media.length})
      </Heading>
      <SimpleGrid columns={{ base: 1, sm: 2, md: isPage ? 4 : 3 }} gap={4}>
        {media.map(item => (
          <Link key={item.id} href={`/media/${item.id}`}>
            <VStack gap={3} align='stretch'>
              {item.youtube_id && (
                <AspectRatio ratio={16 / 9}>
                  <Image
                    src={`https://img.youtube.com/vi/${item.youtube_id}/0.jpg`}
                    alt={item.title}
                    borderRadius='lg'
                  />
                </AspectRatio>
              )}

              <HStack gap={2} align='stretch'>
                {item.creators?.profile_image_url && (
                  <Avatar.Root>
                    <Avatar.Fallback name={item.creators.display_name} />
                    <Avatar.Image src={item.creators.profile_image_url} />
                  </Avatar.Root>
                )}
                <VStack gap={1} align='stretch'>
                  <Text fontWeight='bold' fontSize='sm' lineClamp={2}>
                    {item.title}
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
                    <Text fontSize='xs' color='fg.muted'>
                      {formatDate(
                        item.recorded_date || item.published_at || ''
                      )}
                    </Text>
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
