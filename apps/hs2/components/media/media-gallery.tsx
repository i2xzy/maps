import {
  Card,
  SimpleGrid,
  VStack,
  HStack,
  Text,
  Badge,
  AspectRatio,
  Avatar,
  Heading,
} from '@chakra-ui/react';
import Link from 'next/link';

import { snakeCaseToTitleCase } from '@ui/helpers/text-formatting';
import { formatDate } from '@ui/helpers/date-formatting';

interface Creator {
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
  published_at: string;
  recorded_date: string | null;
  creators: Creator | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
  title?: string;
}

export function MediaGallery({
  media,
  title = 'Related Media',
}: MediaGalleryProps) {
  if (media.length === 0) return null;

  return (
    <Card.Root>
      <Card.Header>
        <Heading size='lg'>
          {title} ({media.length})
        </Heading>
      </Card.Header>
      <Card.Body>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          {media.map(item => (
            <Link key={item.id} href={`/media/${item.id}`}>
              <Card.Root size='sm' variant='subtle'>
                <Card.Body>
                  <VStack gap={3} align='stretch'>
                    {item.youtube_id && (
                      <AspectRatio ratio={16 / 9}>
                        <iframe
                          src={`https://www.youtube.com/embed/${item.youtube_id}`}
                          title={item.title || 'Video'}
                          allowFullScreen
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

                        <VStack gap={0} align='stretch'>
                          {item.creators && (
                            <Text fontSize='xs' color='fg.muted'>
                              {item.creators.display_name}
                            </Text>
                          )}
                          <Text fontSize='xs' color='fg.muted'>
                            {formatDate(
                              item.recorded_date || item.published_at
                            )}
                          </Text>
                        </VStack>
                      </VStack>
                    </HStack>

                    <HStack gap={2} wrap='wrap'>
                      <Badge size='sm' colorPalette='blue'>
                        {snakeCaseToTitleCase(item.type)}
                      </Badge>
                      <Badge size='sm' colorPalette='gray'>
                        {snakeCaseToTitleCase(item.shot_type)}
                      </Badge>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </Link>
          ))}
        </SimpleGrid>
      </Card.Body>
    </Card.Root>
  );
}
