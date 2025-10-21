import {
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Avatar,
  Badge,
} from '@chakra-ui/react';
import { notFound } from 'next/navigation';

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

  // Transform media data to include creator info for MediaGallery component
  const mediaWithCreator =
    mediaData?.map(item => ({
      ...item,
      creators: creator,
    })) || [];

  // Get unique feature types for stats
  const allFeatures =
    mediaData?.flatMap(
      m => m.media_features?.map(mf => mf.features).filter(Boolean) || []
    ) || [];

  const featureTypes = [...new Set(allFeatures.map(f => f.type))];
  const totalFeatures = allFeatures.length;

  return (
    <Container maxW='6xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { title: 'Home', url: '/' },
            { title: 'Creators', url: '/creators' },
            { title: creator.display_name },
          ]}
        />

        {/* Creator Header */}
        <VStack gap={6} align='center'>
          <Avatar.Root size='2xl'>
            <Avatar.Fallback name={creator.display_name} />
            {creator.profile_image_url && (
              <Avatar.Image src={creator.profile_image_url} />
            )}
          </Avatar.Root>

          <VStack gap={2} align='center'>
            <Heading as='h1' size='2xl'>
              {creator.display_name}
            </Heading>
            {creator.bio && (
              <Text textAlign='center' color='gray.600' maxW='2xl'>
                {creator.bio}
              </Text>
            )}
          </VStack>

          {/* Creator Stats */}
          <HStack gap={8} wrap='wrap'>
            <VStack gap={0}>
              <Text fontSize='2xl' fontWeight='bold' color='blue.500'>
                {mediaData?.length || 0}
              </Text>
              <Text fontSize='sm' color='gray.600'>
                Media Items
              </Text>
            </VStack>
            <VStack gap={0}>
              <Text fontSize='2xl' fontWeight='bold' color='green.500'>
                {totalFeatures}
              </Text>
              <Text fontSize='sm' color='gray.600'>
                Features Covered
              </Text>
            </VStack>
            <VStack gap={0}>
              <Text fontSize='2xl' fontWeight='bold' color='purple.500'>
                {featureTypes.length}
              </Text>
              <Text fontSize='sm' color='gray.600'>
                Structure Types
              </Text>
            </VStack>
          </HStack>

          {/* Feature Types */}
          {featureTypes.length > 0 && (
            <HStack gap={2} wrap='wrap'>
              {featureTypes.map(type => (
                <Badge key={type} colorPalette='gray'>
                  {type}
                </Badge>
              ))}
            </HStack>
          )}
        </VStack>

        {/* Creator's Media */}
        <MediaGallery
          media={mediaWithCreator}
          title={`Media by ${creator.display_name}`}
        />
      </VStack>
    </Container>
  );
}
