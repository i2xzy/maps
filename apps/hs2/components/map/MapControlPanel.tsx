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
  Badge,
  Wrap,
  Checkbox,
  Tabs,
  Input,
  InputGroup,
} from '@chakra-ui/react';
import {
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuChevronDown,
  LuChevronRight,
  LuSearch,
} from 'react-icons/lu';

import type { FeatureType, FeatureStatus } from '@supabase/types';
import { featureTypes } from '@/components/feature/config';
import { FeatureIcon } from '@/components/feature/feature-icon';
import { ShotTypeIcon } from '@/components/map/shot-type-config';
import { thinScrollbar } from '@/components/map/panel-styles';

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
  creatorId: string | null;
  year: string;
  center: [number, number];
};

export type YearGroup = { year: string; count: number };
export type CreatorGroup = {
  id: string;
  name: string;
  color: string;
  count: number;
};

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;

  // Features tab
  hiddenTypes: Set<string>;
  hiddenStatuses: Set<string>;
  typeCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  onSetTypes: (types: string[], hidden: boolean) => void;
  onSetStatuses: (statuses: string[], hidden: boolean) => void;
  onResetFilters: () => void;
  features: SearchResult[];
  onSelectResult: (r: SearchResult) => void;

  // Videos tab
  years: YearGroup[];
  hiddenYears: Set<string>;
  onToggleYear: (year: string) => void;
  videos: VideoItem[];
  onSelectVideo: (v: VideoItem) => void;

  // Creators tab
  creators: CreatorGroup[];
  hiddenCreators: Set<string>;
  onToggleCreator: (id: string) => void;
};

// Type chips grouped into one toggle per category (no subtypes).
const TYPE_CATEGORIES: { label: string; types: FeatureType[] }[] = [
  { label: 'Bridges', types: ['overbridge', 'underbridge', 'underpass'] },
  { label: 'Tunnels', types: ['tunnel', 'cut_and_cover'] },
  { label: 'Viaducts', types: ['viaduct', 'box_structure'] },
  { label: 'Stations', types: ['station'] },
  { label: 'Earthworks', types: ['embankment', 'cutting'] },
  { label: 'Other', types: ['shaft', 'culvert'] },
];

// The 13 construction statuses fold into 4 progress bands by colour family.
const STATUS_BANDS: {
  label: string;
  colorPalette: string;
  statuses: NonNullable<FeatureStatus>[];
}[] = [
  { label: 'Not started', colorPalette: 'red', statuses: ['NOT_STARTED', 'PREP_WORK'] },
  { label: 'Groundworks', colorPalette: 'yellow', statuses: ['FOUNDATIONS', 'DIGGING'] },
  {
    label: 'Construction',
    colorPalette: 'blue',
    statuses: ['SEGMENT_INSTALLATION', 'PIERS', 'SIDE_TUNNELS', 'DECK', 'PARAPET', 'SURFACE_BUILDINGS'],
  },
  { label: 'Finishing', colorPalette: 'green', statuses: ['LANDSCAPING', 'CIVILS', 'COMPLETED'] },
];

const plural = (s: string) => (s.endsWith('s') ? s : `${s}s`);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize='xs' fontWeight='semibold' color='fg.muted' textTransform='uppercase'>
    {children}
  </Text>
);

export default function MapControlPanel(props: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [creatorQuery, setCreatorQuery] = useState('');

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

  // Creator list filtered by the in-tab search.
  const cq = creatorQuery.trim().toLowerCase();
  const creatorsFiltered = cq
    ? props.creators.filter(c => c.name.toLowerCase().includes(cq))
    : props.creators;

  // Number of fully-hidden categories + bands, for the "N hidden" badge.
  const totalHidden =
    TYPE_CATEGORIES.filter(c => c.types.every(t => props.hiddenTypes.has(t)))
      .length +
    STATUS_BANDS.filter(b => b.statuses.every(s => props.hiddenStatuses.has(s)))
      .length;

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
          <Tabs.Trigger value='creators'>Creators</Tabs.Trigger>
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
            {/* Collapsible filters (grouped: type categories + status bands) */}
            <Box>
              <HStack justify='space-between'>
                <Button
                  size='xs'
                  variant='ghost'
                  px={1}
                  onClick={() => setFiltersOpen(o => !o)}
                >
                  {filtersOpen ? <LuChevronDown /> : <LuChevronRight />}
                  Filters
                  {totalHidden > 0 && (
                    <Badge ml={1} size='sm' colorPalette='blue'>
                      {totalHidden} hidden
                    </Badge>
                  )}
                </Button>
                {totalHidden > 0 && (
                  <Button
                    size='xs'
                    variant='plain'
                    colorPalette='gray'
                    onClick={props.onResetFilters}
                  >
                    Reset
                  </Button>
                )}
              </HStack>

              {filtersOpen && (
                <Stack gap={3} mt={2}>
                  <Stack gap={1.5}>
                    <SectionLabel>Structure type</SectionLabel>
                    <Wrap gap={1.5}>
                      {TYPE_CATEGORIES.map(cat => {
                        const present = cat.types.filter(
                          t => (props.typeCounts[t] ?? 0) > 0
                        );
                        if (present.length === 0) return null; // hide empty
                        const count = present.reduce(
                          (n, t) => n + (props.typeCounts[t] ?? 0),
                          0
                        );
                        // Collapse to the single type's name when only one is present.
                        const label =
                          present.length === 1
                            ? plural(featureTypes[present[0]!].label)
                            : cat.label;
                        const showing = !cat.types.every(t =>
                          props.hiddenTypes.has(t)
                        );
                        return (
                          <Button
                            key={cat.label}
                            size='xs'
                            variant={showing ? 'subtle' : 'outline'}
                            opacity={showing ? 1 : 0.45}
                            onClick={() => props.onSetTypes(cat.types, showing)}
                          >
                            {label}
                            <Text as='span' color='fg.muted' ml={1}>
                              {count}
                            </Text>
                          </Button>
                        );
                      })}
                    </Wrap>
                  </Stack>
                  <Stack gap={1.5}>
                    <SectionLabel>Construction status</SectionLabel>
                    <Wrap gap={1.5}>
                      {STATUS_BANDS.map(band => {
                        const count = band.statuses.reduce(
                          (n, s) => n + (props.statusCounts[s] ?? 0),
                          0
                        );
                        if (count === 0) return null; // hide empty band
                        const showing = !band.statuses.every(s =>
                          props.hiddenStatuses.has(s)
                        );
                        return (
                          <Button
                            key={band.label}
                            size='xs'
                            variant={showing ? 'subtle' : 'outline'}
                            colorPalette={band.colorPalette}
                            opacity={showing ? 1 : 0.45}
                            onClick={() =>
                              props.onSetStatuses(band.statuses, showing)
                            }
                          >
                            {band.label}
                            <Text as='span' color='fg.muted' ml={1}>
                              {count}
                            </Text>
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
            <Stack gap={0} overflowY='auto' minH='120px' css={thinScrollbar}>
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
            <Stack gap={2} minH='0' flex='1' overflowY='auto' css={thinScrollbar}>
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

        {/* CREATORS TAB */}
        <Tabs.Content
          value='creators'
          display='flex'
          flexDirection='column'
          minH='0'
          flex='1'
          px={4}
          pb={4}
        >
          <Stack gap={3} minH='0' flex='1'>
            <InputGroup startElement={<LuSearch />}>
              <Input
                size='sm'
                placeholder='Search creators'
                value={creatorQuery}
                onChange={e => setCreatorQuery(e.target.value)}
              />
            </InputGroup>
            <Stack gap={1} minH='0' flex='1' overflowY='auto' css={thinScrollbar}>
              {creatorsFiltered.length === 0 ? (
                <Text fontSize='sm' color='fg.muted' px={1} py={2}>
                  No creators match.
                </Text>
              ) : (
                creatorsFiltered.map(c => (
                  <Checkbox.Root
                    key={c.id}
                    size='sm'
                    checked={!props.hiddenCreators.has(c.id)}
                    onCheckedChange={() => props.onToggleCreator(c.id)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Box
                      w='10px'
                      h='10px'
                      borderRadius='full'
                      bg={c.color}
                      borderWidth='1px'
                      borderColor='whiteAlpha.700'
                      flexShrink={0}
                    />
                    <Checkbox.Label flex='1' fontWeight='normal' lineClamp={1}>
                      {c.name}
                    </Checkbox.Label>
                    <Text fontSize='xs' color='fg.muted'>
                      {c.count}
                    </Text>
                  </Checkbox.Root>
                ))
              )}
            </Stack>
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}
