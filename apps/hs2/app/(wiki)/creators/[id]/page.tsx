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

export async function generateMetadata({
  params,
}: PageProps<'/creators/[id]'>): Promise<Metadata> {
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

export default async function CreatorPage({
  params,
}: PageProps<'/creators/[id]'>) {
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

  // Get creator's media
  const { data: mediaData } = await supabase
    .from('media')
    .select('*')
    .eq('creator_id', id)
    .order('published_at', { ascending: false });

  // Get unique features count for this creator
  const { data: featureData } = await supabase
    .from('media_features')
    .select('feature_id')
    .in('media_id', mediaData?.map(m => m.id) || []);

  const totalFeatures = new Set(featureData?.map(f => f.feature_id) || []).size;

  // Helper functions
  const getTimestamp = (url: string | null): number => {
    const match = url?.match(/[?&]t=(\d+)/);
    return match?.[1] ? parseInt(match[1], 10) : -1;
  };

  const stripDate = (title: string) =>
    title.replace(/^\d{4}-\d{2}-\d{2}\s+/, '');
  const getDate = (title: string) =>
    title.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '';

  // Group and deduplicate videos by youtube_id
  const allVideos = mediaData?.filter(m => m.type === 'video') || [];
  const videoMap = new Map<string, typeof allVideos>();

  allVideos.forEach(video => {
    const key = video.youtube_id || `no-id-${video.id}`;
    videoMap.set(key, [...(videoMap.get(key) || []), video]);
  });

  const videos = Array.from(videoMap.values())
    .map(group => {
      if (group.length === 1) return group[0];

      // Sort by timestamp, then combine first and last titles
      const sorted = group.sort(
        (a, b) => getTimestamp(a.url) - getTimestamp(b.url)
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (!first?.title || !last?.title) return first;

      const date = getDate(first.title);
      const combinedTitle = date
        ? `${date} ${stripDate(first.title)} to ${stripDate(last.title)}`
        : `${stripDate(first.title)} to ${stripDate(last.title)}`;

      return { ...first, title: combinedTitle };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null && v !== undefined);

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
