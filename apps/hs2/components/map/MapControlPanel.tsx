'use client';

/**
 * Control panel for the map workspace — two tabs:
 *  - Features: collapsible type/status filters + a route-ordered structure list.
 *  - Videos:   per-year layer toggles (show/hide that year's video markers) +
 *              a list of videos in the visible years.
 * Pure presentational — all state lives in MapView; this emits callbacks.
 */
import { useState } from 'react';
import {
  Box,
  Stack,
  HStack,
  Text,
  Heading,
  IconButton,
  Button,
  Wrap,
  Checkbox,
  Tabs,
} from '@chakra-ui/react';
import {
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuChevronDown,
  LuChevronRight,
} from 'react-icons/lu';

import type { FeatureType, FeatureStatus } from '@supabase/types';
import { featureTypes, featureStatuses } from '@/components/feature/config';
import { FeatureIcon } from '@/components/feature/feature-icon';
import { TYPE_COLORS } from '@/components/map/map-colors';
import { ShotTypeIcon } from '@/components/map/shot-type-config';

export type SearchResult = {
  id: string;
  name: string;
  type: FeatureType;
  center: [number, number];
  chainage?: number | null;
};

export type VideoItem = {
  id: string;
  youtubeId: string;
  title: string;
  recordedDate: string | null;
  publishedDate: string | null;
  shotType: string | null;
  year: string;
  center: [number, number];
};

export type YearGroup = { year: string; count: number };

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;

  // Features tab
  hiddenTypes: Set<string>;
  onToggleType: (type: FeatureType) => void;
  hiddenStatuses: Set<string>;
  onToggleStatus: (status: NonNullable<FeatureStatus>) => void;
  features: SearchResult[];
  onSelectResult: (r: SearchResult) => void;

  // Videos tab
  years: YearGroup[];
  hiddenYears: Set<string>;
  onToggleYear: (year: string) => void;
  videos: VideoItem[];
  onSelectVideo: (v: VideoItem) => void;
};

const TYPE_KEYS = Object.keys(featureTypes) as FeatureType[];
const STATUS_KEYS = Object.keys(
  featureStatuses
) as NonNullable<FeatureStatus>[];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize='xs' fontWeight='semibold' color='fg.muted' textTransform='uppercase'>
    {children}
  </Text>
);

export default function MapControlPanel(props: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  if (props.collapsed) {
    return (
      <IconButton
        aria-label='Open controls'
        size='sm'
        variant='solid'
        bg='bg.panel'
        color='fg'
        shadow='md'
        position='absolute'
        top={3}
        left={3}
        onClick={props.onToggleCollapsed}
      >
        <LuPanelLeftOpen />
      </IconButton>
    );
  }

  // Group the (all-years) video list by year for the Videos tab accordion.
  const videosByYear = new Map<string, VideoItem[]>();
  for (const v of props.videos) {
    const arr = videosByYear.get(v.year);
    if (arr) arr.push(v);
    else videosByYear.set(v.year, [v]);
  }

  return (
    <Box
      position='absolute'
      top={3}
      left={3}
      w={{ base: 'calc(100% - 24px)', sm: '300px' }}
      maxH='calc(100% - 24px)'
      display='flex'
      flexDirection='column'
      bg='bg.panel'
      borderWidth='1px'
      borderColor='border'
      borderRadius='lg'
      shadow='lg'
    >
      <HStack justify='space-between' px={4} pt={3}>
        <Heading size='sm'>Explore the map</Heading>
        <IconButton
          aria-label='Collapse controls'
          size='xs'
          variant='ghost'
          onClick={props.onToggleCollapsed}
        >
          <LuPanelLeftClose />
        </IconButton>
      </HStack>

      <Tabs.Root
        defaultValue='features'
        size='sm'
        display='flex'
        flexDirection='column'
        minH='0'
        flex='1'
      >
        <Tabs.List px={4}>
          <Tabs.Trigger value='features'>Features</Tabs.Trigger>
          <Tabs.Trigger value='videos'>Videos</Tabs.Trigger>
        </Tabs.List>

        {/* FEATURES TAB */}
        <Tabs.Content
          value='features'
          display='flex'
          flexDirection='column'
          minH='0'
          flex='1'
          px={4}
          pb={4}
        >
          <Stack gap={3} minH='0' flex='1'>
            {/* Collapsible filters */}
            <Box>
              <Button
                size='xs'
                variant='ghost'
                px={1}
                onClick={() => setFiltersOpen(o => !o)}
              >
                {filtersOpen ? <LuChevronDown /> : <LuChevronRight />}
                Filters
              </Button>

              {filtersOpen && (
                <Stack gap={3} mt={2}>
                  <Stack gap={1.5}>
                    <SectionLabel>Structure type</SectionLabel>
                    <Wrap gap={1.5}>
                      {TYPE_KEYS.map(type => {
                        const active = !props.hiddenTypes.has(type);
                        return (
                          <Button
                            key={type}
                            size='xs'
                            variant={active ? 'subtle' : 'outline'}
                            opacity={active ? 1 : 0.45}
                            onClick={() => props.onToggleType(type)}
                          >
                            <Box w='8px' h='8px' borderRadius='full' bg={TYPE_COLORS[type]} mr={1} />
                            {featureTypes[type].label}
                          </Button>
                        );
                      })}
                    </Wrap>
                  </Stack>
                  <Stack gap={1.5}>
                    <SectionLabel>Construction status</SectionLabel>
                    <Wrap gap={1.5}>
                      {STATUS_KEYS.map(status => {
                        const active = !props.hiddenStatuses.has(status);
                        return (
                          <Button
                            key={status}
                            size='xs'
                            variant={active ? 'subtle' : 'outline'}
                            colorPalette={featureStatuses[status].colorPalette}
                            opacity={active ? 1 : 0.45}
                            onClick={() => props.onToggleStatus(status)}
                          >
                            {featureStatuses[status].labelShort ?? featureStatuses[status].label}
                          </Button>
                        );
                      })}
                    </Wrap>
                  </Stack>
                </Stack>
              )}
            </Box>

            {/* Structure list */}
            <SectionLabel>Structures ({props.features.length})</SectionLabel>
            <Stack gap={0} overflowY='auto' minH='120px'>
              {props.features.length === 0 ? (
                <Text fontSize='sm' color='fg.muted' px={1} py={2}>
                  No structures match.
                </Text>
              ) : (
                props.features.map(r => (
                  <HStack
                    key={r.id}
                    as='button'
                    gap={2}
                    px={2}
                    py={1}
                    borderRadius='md'
                    textAlign='left'
                    _hover={{ bg: 'bg.muted' }}
                    onClick={() => props.onSelectResult(r)}
                  >
                    <FeatureIcon type={r.type} name={r.name} />
                    <Text fontSize='xs' lineClamp={1}>
                      {r.name}
                    </Text>
                  </HStack>
                ))
              )}
            </Stack>
          </Stack>
        </Tabs.Content>

        {/* VIDEOS TAB */}
        <Tabs.Content
          value='videos'
          display='flex'
          flexDirection='column'
          minH='0'
          flex='1'
          px={4}
          pb={4}
        >
          <Stack gap={3} minH='0' flex='1'>
            {/* Each year is a checkbox header; its videos nest beneath and
                collapse (and their markers hide) when unchecked. */}
            <Stack gap={2} minH='0' flex='1' overflowY='auto'>
              {props.years.length === 0 ? (
                <Text fontSize='sm' color='fg.muted'>
                  No videos loaded.
                </Text>
              ) : (
                props.years.map(({ year, count }) => {
                  const shown = !props.hiddenYears.has(year);
                  const vids = videosByYear.get(year) ?? [];
                  return (
                    <Box key={year}>
                      <Checkbox.Root
                        size='sm'
                        checked={shown}
                        onCheckedChange={() => props.onToggleYear(year)}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label flex='1' fontWeight='medium'>
                          {year}
                        </Checkbox.Label>
                        <Text fontSize='xs' color='fg.muted'>
                          {count}
                        </Text>
                      </Checkbox.Root>

                      {shown && (
                        <Stack gap={0} pl={5} pt={1}>
                          {vids.map(v => (
                            <HStack
                              key={v.id}
                              as='button'
                              gap={2}
                              px={2}
                              py={1}
                              borderRadius='md'
                              textAlign='left'
                              _hover={{ bg: 'bg.muted' }}
                              onClick={() => props.onSelectVideo(v)}
                            >
                              <ShotTypeIcon shotType={v.shotType} />
                              <Text fontSize='xs' lineClamp={1}>
                                {v.title}
                              </Text>
                            </HStack>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  );
                })
              )}
            </Stack>
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}
