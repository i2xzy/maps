import type { Metadata } from 'next';
import {
  Container,
  VStack,
  HStack,
  Text,
  Avatar,
  Card,
  SimpleGrid,
  Link as ChakraLink,
  DataList,
  Image,
} from '@chakra-ui/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@supabase/server';
import {
  snakeCaseToTitleCase,
  getInitials,
} from '@ui/helpers/text-formatting';
import { formatDate } from '@ui/helpers/date-formatting';
import { Breadcrumb } from '@ui/components/breadcrumb';
import {
  buildChapters,
  collectFeatures,
  type MediaSegment,
} from '@/utils/media-grouping';
import MediaFeatures from './media-features';
import VideoPlayer from './VideoPlayer';
import ChapterList from './chapter-list';
import { VideoPlayerProvider } from './video-player-context';

export async function generateMetadata({
  params,
}: PageProps<'/media/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: media } = await supabase
    .from('media')
    .select(
      `
      title,
      description,
      type,
      creators (display_name)
    `
    )
    .eq('id', id)
    .single();

  if (!media) {
    return {
      title: 'Media Not Found',
    };
  }

  const creatorName = media.creators?.display_name || 'Unknown Creator';
  const mediaType = media.type === 'video' ? 'Video' : 'Image';

  return {
    title: media.description || media.title,
    description:
      media.description ||
      `${mediaType} of HS2 construction by ${creatorName}. Watch and explore High Speed 2 railway project updates.`,
  };
}

export default async function MediaPage({ params }: PageProps<'/media/[id]'>) {
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
          chainage,
          chainage_end
        )
      )
    `
    )
    .eq('id', id)
    .single();

  if (!media) {
    notFound();
  }

  // A YouTube video may be stored as several rows (one per Google My Maps pin),
  // each a timestamped "chapter". Gather the siblings by youtube_id, then build
  // the chapter list and the union of features. Images and un-grouped rows fall
  // back to just this row.
  let segments: MediaSegment[] = [media];
  if (media.youtube_id) {
    const { data: siblings } = await supabase
      .from('media')
      .select(
        `
        url,
        title,
        media_features (
          features ( id, name, type, status, chainage, chainage_end )
        )
      `
      )
      .eq('youtube_id', media.youtube_id);
    if (siblings && siblings.length > 0) segments = siblings;
  }

  const chapters = buildChapters(segments);
  const relatedFeatures = collectFeatures(segments);

  return (
    <Container maxW='8xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { title: 'Media', url: '/media' },
            { title: media.description || media.title },
          ]}
        />

        <VideoPlayerProvider>
        <SimpleGrid gap={8} templateColumns={{ base: '1fr', lg: '1fr 300px' }}>
          {/* Media Content */}
          <VStack gap={2} align='start'>
            {media.youtube_id && (
              <VideoPlayer
                src={`https://www.youtube.com/embed/${media.youtube_id}`}
              />
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
                    <Avatar.Fallback name={media.creators.display_name}>
                      {getInitials(media.creators.display_name)}
                    </Avatar.Fallback>
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

          {/* Sidebar: chapter navigation + related features */}
          <VStack gap={8} align='stretch'>
            <ChapterList chapters={chapters} />
            {relatedFeatures.length > 0 && (
              <MediaFeatures relatedFeatures={relatedFeatures} />
            )}
          </VStack>
        </SimpleGrid>
        </VideoPlayerProvider>
      </VStack>
    </Container>
  );
}
