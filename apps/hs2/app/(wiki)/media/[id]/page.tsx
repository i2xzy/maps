import {
  Container,
  VStack,
  HStack,
  Text,
  Avatar,
  Card,
  AspectRatio,
  SimpleGrid,
  Link as ChakraLink,
  DataList,
  Image,
} from '@chakra-ui/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@supabase/server';
import { snakeCaseToTitleCase } from '@ui/helpers/text-formatting';
import { formatDate } from '@ui/helpers/date-formatting';
import { Breadcrumb } from '@ui/components/breadcrumb';
import MediaFeatures from './media-features';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MediaPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  // Get media item with creator and related features
  const { data: media } = await supabase
    .from('media')
    .select(
      `
      *,
      creators (
        id,
        display_name,
        profile_image_url
      ),
      media_features (
        features (
          id,
          name,
          type,
          status,
          chainage
        )
      )
    `
    )
    .eq('id', id)
    .single();

  if (!media) {
    notFound();
  }

  const relatedFeatures =
    media.media_features?.map(mf => mf.features).filter(Boolean) || [];

  return (
    <Container maxW='8xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[{ title: 'Media', url: '/media' }, { title: media.title }]}
        />

        <SimpleGrid gap={8} templateColumns={{ base: '1fr', lg: '1fr 300px' }}>
          {/* Media Content */}
          <VStack gap={2} align='start'>
            {media.youtube_id && (
              <AspectRatio ratio={16 / 9} w='full'>
                <iframe
                  src={`https://www.youtube.com/embed/${media.youtube_id}`}
                  title={media.title}
                  allowFullScreen
                />
              </AspectRatio>
            )}
            {media.type === 'image' && (
              <>
                <Image src={media.url} alt={media.title} borderRadius='lg' />
                <Text fontWeight='semibold' fontSize='xl'>
                  {media.title}
                </Text>
              </>
            )}
            {media.description && (
              <ChakraLink href={media.url} target='_blank'>
                <Text fontWeight='bold' fontSize='xl'>
                  {media.description}
                </Text>
              </ChakraLink>
            )}

            {media.creators && (
              <Link href={`/creators/${media.creators.id}`}>
                <HStack gap={4} align='center'>
                  <Avatar.Root>
                    <Avatar.Fallback name={media.creators.display_name} />
                    {media.creators.profile_image_url && (
                      <Avatar.Image src={media.creators.profile_image_url} />
                    )}
                  </Avatar.Root>
                  <Text fontWeight='semibold' fontSize='md'>
                    {media.creators.display_name}
                  </Text>
                </HStack>
              </Link>
            )}
            {/* Media Info */}
            <Card.Root bg='bg.subtle' w='full'>
              <Card.Body>
                <DataList.Root orientation='horizontal'>
                  {media.published_at && (
                    <DataList.Item>
                      <DataList.ItemLabel>Published:</DataList.ItemLabel>
                      <DataList.ItemValue>
                        {formatDate(media.published_at)}
                      </DataList.ItemValue>
                    </DataList.Item>
                  )}
                  {media.recorded_date && (
                    <DataList.Item>
                      <DataList.ItemLabel>Recorded:</DataList.ItemLabel>
                      <DataList.ItemValue>
                        {formatDate(media.recorded_date)}
                      </DataList.ItemValue>
                    </DataList.Item>
                  )}
                  <DataList.Item>
                    <DataList.ItemLabel>
                      {media.type === 'video' ? 'Shot' : 'Image'} Type:
                    </DataList.ItemLabel>
                    <DataList.ItemValue>
                      {snakeCaseToTitleCase(media.shot_type)}
                    </DataList.ItemValue>
                  </DataList.Item>
                </DataList.Root>
              </Card.Body>
            </Card.Root>
          </VStack>

          {/* Related Features */}
          {relatedFeatures.length > 0 && (
            <MediaFeatures relatedFeatures={relatedFeatures} />
          )}
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
