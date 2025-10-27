import type { Metadata } from 'next';
import {
  Button,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Avatar,
  Link as ChakraLink,
  Tabs,
} from '@chakra-ui/react';
import { notFound } from 'next/navigation';
import { FaYoutube } from 'react-icons/fa6';

import { createClient } from '@supabase/server';
import { Breadcrumb } from '@ui/components/breadcrumb';
import { MediaGallery } from '@/components/media/media-gallery';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from('creators')
    .select('display_name')
    .eq('id', id)
    .single();

  if (!creator) {
    return {
      title: 'Creator Not Found',
    };
  }

  return {
    title: creator.display_name,
    description: `View all HS2 construction videos and images from ${creator.display_name}. Follow their documentation of the High Speed 2 railway project.`,
  };
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

  const videos = mediaData?.filter(m => m.type === 'video') || [];
  const images = mediaData?.filter(m => m.type === 'image') || [];

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
                  {' • '} {videos?.length} videos
                </Text>
                {images && images.length > 0 && (
                  <Text as='span' color='fg.muted'>
                    {' • '} {images.length} images
                  </Text>
                )}
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

        {images.length > 0 ? (
          <Tabs.Root
            defaultValue={videos.length > 0 ? 'videos' : 'images'}
            orientation='horizontal'
          >
            <Tabs.List>
              <Tabs.Trigger value='videos'>
                Videos ({videos?.length})
              </Tabs.Trigger>
              <Tabs.Trigger value='images'>
                Images ({images?.length})
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value='videos'>
              <MediaGallery media={videos} isPage />
            </Tabs.Content>
            <Tabs.Content value='images'>
              <MediaGallery media={images} isPage />
            </Tabs.Content>
          </Tabs.Root>
        ) : (
          <MediaGallery media={videos} title='Videos' isPage />
        )}
      </VStack>
    </Container>
  );
}
