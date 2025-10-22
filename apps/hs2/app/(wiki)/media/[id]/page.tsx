import {
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Avatar,
  Card,
  AspectRatio,
  SimpleGrid,
  Link as ChakraLink,
} from '@chakra-ui/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@supabase/server';
import { snakeCaseToTitleCase } from '@ui/helpers/text-formatting';
import { formatDate } from '@ui/helpers/date-formatting';
import { Breadcrumb } from '@ui/components/breadcrumb';
import { getFeatureHref } from '@/utils/feature-routing';
import { FeatureIcon } from '@/components/feature/feature-icon';

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
          phase
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

  console.log('date', media.published_at);

  return (
    <Container maxW='8xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[{ title: 'Media', url: '/media' }, { title: media.title }]}
        />

        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={8}>
          {/* Media Content */}
          <VStack gap={2} align='start' gridColumn={{ base: 1, lg: '1 / 3' }}>
            {media.youtube_id && (
              <AspectRatio ratio={16 / 9} w='full'>
                <iframe
                  src={`https://www.youtube.com/embed/${media.youtube_id}`}
                  title={media.title}
                  allowFullScreen
                />
              </AspectRatio>
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
            <Card.Root variant='subtle' bg='gray.950' w='full'>
              <Card.Body>
                <VStack gap={3} align='start'>
                  <HStack justify='space-between'>
                    <Text fontWeight='medium'>Published:</Text>
                    {media.published_at && (
                      <Text fontSize='sm'>
                        {formatDate(media.published_at)}
                      </Text>
                    )}
                  </HStack>
                  {media.recorded_date && (
                    <HStack justify='space-between'>
                      <Text fontWeight='medium'>Recorded:</Text>
                      <Text fontSize='sm'>
                        {formatDate(media.recorded_date)}
                      </Text>
                    </HStack>
                  )}
                  <HStack justify='space-between'>
                    <Text fontWeight='medium'>Shot Type:</Text>
                    <Text>{snakeCaseToTitleCase(media.shot_type)}</Text>
                  </HStack>
                </VStack>
              </Card.Body>
            </Card.Root>
          </VStack>

          {/* Related Features */}
          {relatedFeatures.length > 0 && (
            <VStack gap={4} align='stretch'>
              <Heading size='lg'>
                Featured Structures ({relatedFeatures.length})
              </Heading>

              <VStack gap={4} align='stretch'>
                {relatedFeatures.map(feature => (
                  <Link
                    key={feature.id}
                    href={getFeatureHref(feature.type, feature.id)}
                  >
                    <Card.Root variant='subtle'>
                      <Card.Body p={4}>
                        <HStack gap={4}>
                          <FeatureIcon
                            feature={{
                              id: feature.id,
                              name: feature.name,
                              type: feature.type,
                            }}
                          />
                          <Text fontWeight='semibold' fontSize='sm'>
                            {feature.name}
                          </Text>
                        </HStack>
                      </Card.Body>
                    </Card.Root>
                  </Link>
                ))}
              </VStack>
            </VStack>
          )}
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
