import {
  Button,
  Container,
  VStack,
  HStack,
  Text,
  Card,
  SimpleGrid,
  Heading,
  DataList,
} from '@chakra-ui/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiAdobeacrobatreader } from 'react-icons/si';

import { createClient } from '@supabase/server';
import { formatChainage } from '@ui/helpers/text-formatting';
import { Breadcrumb } from '@ui/components/breadcrumb';
import { getFeatureHref } from '@/utils/feature-routing';
import { FeatureIcon } from '@/components/feature/feature-icon';
import { REGIONS } from '../../config';

interface PageProps {
  params: Promise<{ region: string; id: string }>;
}

export default async function PlanPage({ params }: PageProps) {
  const { region, id } = await params;
  const regionData = REGIONS.find(r => r.id === region);

  if (!regionData) {
    notFound();
  }

  const supabase = await createClient();

  // Get plan item with related features
  const { data: plan } = await supabase
    .from('groupings')
    .select(
      `
      *,
      grouping_features (
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

  if (!plan) {
    notFound();
  }

  const relatedFeatures =
    plan.grouping_features
      ?.map(gf => gf.features)
      .filter(gf => gf.chainage !== null && !gf.name.includes('West Viaduct'))
      .map(gf => ({
        ...gf,
        name: gf.name.includes('East Viaduct')
          ? gf.name.replace('East Viaduct', 'East and West Viaducts')
          : gf.name,
      }))
      .sort((a, b) => (a.chainage ?? 0) - (b.chainage ?? 0)) || [];

  return (
    <Container maxW='8xl' py={8}>
      <VStack gap={8} align='stretch'>
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { title: 'Route', url: '/route' },
            { title: regionData.name, url: `/route/${region}` },
            { title: plan.name },
          ]}
        />

        <SimpleGrid gap={8} templateColumns={{ base: '1fr', lg: '1fr auto' }}>
          {/* Media Content */}
          <VStack gap={4} align='start'>
            <HStack gap={2} justify='space-between' w='full'>
              {plan.description && (
                <Heading as='h1' size='2xl'>
                  {plan.description}
                </Heading>
              )}
              {plan.url && (
                <Button colorPalette='red' size='xs' asChild>
                  <a href={plan.url} target='_blank' rel='noopener noreferrer'>
                    <SiAdobeacrobatreader />
                    <Text as='span' fontWeight='bold' color='fg'>
                      Open PDF
                    </Text>
                  </a>
                </Button>
              )}
            </HStack>

            {/* Plan Info */}
            <Card.Root bg='bg.subtle' w='full'>
              <Card.Body>
                <DataList.Root orientation='horizontal'>
                  <DataList.Item>
                    <DataList.ItemLabel>HS2 Zone</DataList.ItemLabel>
                    <DataList.ItemValue>{plan.zone}</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>Drawing Title</DataList.ItemLabel>
                    <DataList.ItemValue>{plan.name}</DataList.ItemValue>
                  </DataList.Item>
                  {plan.chainage_from !== null && plan.chainage_to !== null && (
                    <DataList.Item>
                      <DataList.ItemLabel>Chainage</DataList.ItemLabel>
                      <DataList.ItemValue>
                        {formatChainage(plan.chainage_from)} to{' '}
                        {formatChainage(plan.chainage_to)}
                      </DataList.ItemValue>
                    </DataList.Item>
                  )}
                  <DataList.Item>
                    <DataList.ItemLabel>Drawing No.</DataList.ItemLabel>
                    <DataList.ItemValue>{plan.external_id}</DataList.ItemValue>
                  </DataList.Item>
                </DataList.Root>
              </Card.Body>
            </Card.Root>
          </VStack>

          {/* Related Features */}
          {relatedFeatures.length > 0 && (
            <VStack gap={4} align='stretch'>
              <Heading size='lg'>
                Related Features ({relatedFeatures.length})
              </Heading>
              {relatedFeatures.map(feature => (
                <Link
                  key={feature.id}
                  href={getFeatureHref(feature.type, feature.id)}
                >
                  <Card.Root>
                    <Card.Body p={4}>
                      <HStack gap={4}>
                        <FeatureIcon {...feature} />
                        <Text
                          fontWeight='semibold'
                          fontSize='sm'
                          color='blue.400'
                        >
                          {feature.name}
                        </Text>
                      </HStack>
                    </Card.Body>
                  </Card.Root>
                </Link>
              ))}
            </VStack>
          )}
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
