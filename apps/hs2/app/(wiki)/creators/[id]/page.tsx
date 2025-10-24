import {
  Button,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Avatar,
  Link as ChakraLink,
} from '@chakra-ui/react';
import { notFound } from 'next/navigation';
import { FaYoutube } from 'react-icons/fa6';

import { createClient } from '@supabase/server';
import { Breadcrumb } from '@ui/components/breadcrumb';
import { MediaGallery } from '@/components/media/media-gallery';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CreatorPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  // Get creator details
  const { data: creator } = await supabase
    .from('creators')
    .select('*')
    .eq('id', id)
    .single();

  if (!creator) {
    notFound();
  }

  // Get creator's media with related features
  const { data: mediaData } = await supabase
    .from('media')
    .select(
      `
      *,
      media_features!inner (
        features (
          id,
          name,
          type
        )
      )
    `
    )
    .eq('creator_id', id)
    .order('published_at', { ascending: false });

  // Get the total number of features covered by the creator
  const allFeatures =
    mediaData?.flatMap(
      m => m.media_features?.map(mf => mf.features).filter(Boolean) || []
    ) || [];

  const totalFeatures = allFeatures.length;

  return (
    <Container maxW='6xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { title: 'Creators', url: '/creators' },
            { title: creator.display_name },
          ]}
        />

        {/* Creator Header */}
        <HStack gap={6}>
          <Avatar.Root size='2xl'>
            <Avatar.Fallback name={creator.display_name} />
            {creator.profile_image_url && (
              <Avatar.Image src={creator.profile_image_url} />
            )}
          </Avatar.Root>
          <VStack gap={4} align='start'>
            <VStack gap={2} align='start'>
              <Heading as='h1' size='3xl'>
                {creator.display_name}
              </Heading>
              <Text fontSize='sm'>
                <ChakraLink href={creator.url} target='_blank'>
                  <Text as='span' fontWeight='bold'>
                    @{creator.external_id}
                  </Text>
                </ChakraLink>
                <Text as='span' color='fg.muted'>
                  {' • '} {mediaData?.length || 0} videos
                </Text>
                {totalFeatures > 0 && (
                  <Text as='span' color='fg.muted'>
                    {' • '} {totalFeatures} features covered
                  </Text>
                )}
              </Text>
              {creator.bio && (
                <Text textAlign='center' color='gray.600' maxW='2xl'>
                  {creator.bio}
                </Text>
              )}
            </VStack>
            {creator.platform === 'youtube' && (
              <Button colorPalette='red' size='xs' asChild>
                <a href={creator.url} target='_blank' rel='noopener noreferrer'>
                  <FaYoutube />
                  <Text as='span' fontWeight='bold'>
                    Open in YouTube
                  </Text>
                </a>
              </Button>
            )}
          </VStack>
        </HStack>

        {/* Creator's Media */}
        <MediaGallery media={mediaData} title='Videos' isPage />
      </VStack>
    </Container>
  );
}
