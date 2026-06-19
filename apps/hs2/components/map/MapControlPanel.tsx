'use client';

/**
 * Control panel for the map workspace — two tabs:
 *  - Features: collapsible type/status filters + a route-ordered structure list.
 *  - Videos:   per-year layer toggles (show/hide that year's video markers) +
 *              a list of videos in the visible years.
 * Pure presentational — all state lives in MapView; this emits callbacks.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  Circle,
  Stack,
  HStack,
  Separator,
  Text,
  Heading,
  IconButton,
  Button,
  Badge,
  Wrap,
  Checkbox,
  Checkmark,
  Tabs,
  Input,
  InputGroup,
  Listbox,
  createListCollection,
} from '@chakra-ui/react';
import { thinScrollbar } from '@/components/map/panel-styles';
import {
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuChevronDown,
  LuChevronRight,
  LuSearch,
} from 'react-icons/lu';

import type { FeatureType, FeatureStatus } from '@supabase/types';
import { featureTypes } from '@/components/feature/config';
import { FeatureDisc, VideoDisc } from '@/components/map/marker-disc';
import DateRangeFilter from '@/components/map/DateRangeFilter';

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
  /** The video's marker colour (creator colour, or grey default). */
  color: string;
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
  onSetYears: (years: string[], hidden: boolean) => void;
  onOnlyYear: (year: string) => void;
  /** Active video date range (ISO strings) — controls the picker so it stays in
   *  sync with the live filter across panel collapse/remount. */
  dateRange: string[];
  /** Active video date range changed (ISO strings: [], [from], or [from,to]). */
  onDateRangeChange: (range: string[]) => void;
  /** Oldest video date (ISO) — the date filter's min bound. */
  earliestVideoDate?: string | null;
  videos: VideoItem[];
  onSelectVideo: (v: VideoItem) => void;

  // Creators tab
  creators: CreatorGroup[];
  hiddenCreators: Set<string>;
  onToggleCreator: (id: string) => void;
  onSetCreators: (ids: string[], hidden: boolean) => void;
  /** Replace the shown-creator set (from the multi-select listbox value). */
  onSetShownCreators: (shownIds: string[]) => void;
  onOnlyCreator: (id: string) => void;

  /** id of the currently-selected feature or video, highlighted in its list. */
  selectedId: string | null;
  /** Whether the current selection is a feature or a video — disambiguates the
   *  shared id so a video selection can't activate a feature row (or vice versa). */
  selectedKind: 'feature' | 'video' | null;
};

// Tri-state "select all" header for a checkbox list: checked = all shown,
// unchecked = all hidden, indeterminate = some hidden. Clicking shows all
// unless everything is already shown, in which case it hides all.
const MasterCheckbox = ({
  label,
  shown,
  total,
  onSetAll,
}: {
  label: string;
  shown: number;
  total: number;
  onSetAll: (hidden: boolean) => void;
}) => (
  <Checkbox.Root
    size='sm'
    cursor='pointer'
    checked={shown === total ? true : shown === 0 ? false : 'indeterminate'}
    onCheckedChange={() => onSetAll(shown === total)}
  >
    <Checkbox.HiddenInput />
    <Checkbox.Control cursor='inherit' />
    <Checkbox.Label flex='1' fontWeight='semibold'>
      {label}
    </Checkbox.Label>
    <Text fontSize='xs' color='fg.muted'>
      {shown}/{total}
    </Text>
  </Checkbox.Root>
);

// Reveals a row's trailing "Only" button on hover, or when the button itself is
// keyboard-focused. Scoped to the button's own :focus-visible (NOT the row's
// :focus-within) so clicking the row's checkbox doesn't leave the button stuck
// visible via lingering focus.
const onlyRevealCss = {
  '& [data-only]': { opacity: 0, transition: 'opacity 0.12s' },
  '&:hover [data-only], & [data-only]:focus-visible': { opacity: 1 },
};

// Creator rows: keep the hover highlight on EVERY row, but drop the *resting*
// checked-row background (creators are filter toggles, not a selection — the
// checkmark conveys shown/hidden). `:not(:hover)` lets the recipe's hover bg
// win when a checked row is hovered.
const creatorItemCss = {
  ...onlyRevealCss,
  '&[data-selected]:not(:hover)': { background: 'transparent' },
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

  // When the selection changes (e.g. a marker picked on the map), scroll its
  // row into view so the highlighted item isn't lost off-screen in a long list.
  // The matching row (feature or video) attaches this ref; on change the old row
  // detaches it (→ null), so a no-longer-rendered selection just no-ops.
  const selectedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [props.selectedId]);

  // Listbox collections. Structures change with the type/status filters, so the
  // collection rebuilds when the list changes; creators are mount-stable (the
  // search filters which rows we render, not the collection — Ark keeps `value`
  // across the full set, so a creator's selection survives searching).
  const featureCollection = useMemo(
    () =>
      createListCollection({
        items: props.features,
        itemToValue: f => f.id,
        itemToString: f => f.name,
      }),
    [props.features]
  );
  const creatorCollection = useMemo(
    () =>
      createListCollection({
        items: props.creators,
        itemToValue: c => c.id,
        itemToString: c => c.name,
      }),
    [props.creators]
  );
  // Creators currently shown (= selected in the multi-select listbox).
  const shownCreatorIds = props.creators
    .map(c => c.id)
    .filter(id => !props.hiddenCreators.has(id));

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

  // Bulk show/hide universes + how many are currently shown (for the headers).
  const allYears = props.years.map(y => y.year);
  const shownYears = allYears.filter(y => !props.hiddenYears.has(y)).length;
  const allCreatorIds = props.creators.map(c => c.id);
  const shownCreators = allCreatorIds.filter(
    id => !props.hiddenCreators.has(id)
  ).length;

  // Number of fully-hidden categories + bands, for the "N hidden" badge.
  const totalHidden =
    TYPE_CATEGORIES.filter(c => c.types.every(t => props.hiddenTypes.has(t)))
      .length +
    STATUS_BANDS.filter(b => b.statuses.every(s => props.hiddenStatuses.has(s)))
      .length;

  return (
    <Card.Root
      position='absolute'
      top={3}
      left={3}
      w={{ base: 'calc(100% - 24px)', sm: '300px' }}
      maxH='calc(100% - 24px)'
      display='flex'
      flexDirection='column'
      variant='elevated'
      borderRadius='lg'
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
            {/* Single-select Listbox: keyboard nav + typeahead (type a name to
                jump) + ARIA, controlled by the active selection. */}
            <Listbox.Root
              collection={featureCollection}
              selectionMode='single'
              // Only feed the value when the selected id is actually a feature in
              // this collection — only when a *feature* is selected (a video
              // shares the selectedId prop and must not become a phantom item).
              value={
                props.selectedKind === 'feature' &&
                props.selectedId &&
                featureCollection.items.some(f => f.id === props.selectedId)
                  ? [props.selectedId]
                  : []
              }
              onValueChange={e => {
                const r = props.features.find(f => f.id === e.value[0]);
                if (r) props.onSelectResult(r);
              }}
              display='flex'
              flexDirection='column'
              flex='1'
              minH='120px'
            >
              <Listbox.Content
                flex='1'
                minH='0'
                maxH='unset'
                gap={0}
                p={0}
                borderWidth='0'
                boxShadow='none'
                bg='transparent'
                css={thinScrollbar}
              >
                <Listbox.Empty fontSize='sm' color='fg.muted' px={1} py={2}>
                  No structures match.
                </Listbox.Empty>
                {featureCollection.items.map(r => (
                  <Listbox.Item
                    key={r.id}
                    item={r}
                    ref={
                      props.selectedKind === 'feature' && r.id === props.selectedId
                        ? selectedRowRef
                        : undefined
                    }
                    gap={2}
                    px={2}
                    py={1}
                    fontSize='xs'
                    _selected={{ bg: 'bg.emphasized', fontWeight: 'semibold' }}
                  >
                    <FeatureDisc type={r.type} name={r.name} />
                    <Listbox.ItemText lineClamp={1}>{r.name}</Listbox.ItemText>
                  </Listbox.Item>
                ))}
              </Listbox.Content>
            </Listbox.Root>
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
            <DateRangeFilter
              value={props.dateRange}
              onChange={props.onDateRangeChange}
              minDate={props.earliestVideoDate}
            />
            {props.years.length > 0 && (
              <>
                <MasterCheckbox
                  label='All years'
                  shown={shownYears}
                  total={allYears.length}
                  onSetAll={hidden => props.onSetYears(allYears, hidden)}
                />
                <Separator />
              </>
            )}
            {/* Each year is a checkbox header; its videos nest beneath and
                collapse (and their markers hide) when unchecked. */}
            <Stack
              gap={2}
              minH='0'
              flex='1'
              overflowY='auto'
              css={thinScrollbar}
              separator={<Separator />}
            >
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
                      <HStack position='relative' pe={2} css={onlyRevealCss}>
                        <Checkbox.Root
                          size='sm'
                          flex='1'
                          minW='0'
                          cursor='pointer'
                          checked={shown}
                          onCheckedChange={() => props.onToggleYear(year)}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control cursor='inherit' />
                          <Checkbox.Label flex='1' fontWeight='medium'>
                            {year}
                          </Checkbox.Label>
                          <Text fontSize='xs' color='fg.muted'>
                            {count}
                          </Text>
                        </Checkbox.Root>
                        {(shownYears > 1 || !shown) && (
                          <Button
                            data-only=''
                            variant='subtle'
                            size='xs'
                            minW='0'
                            h='5'
                            px={1}
                            fontSize='2xs'
                            position='absolute'
                            insetEnd={0.5}
                            top='50%'
                            transform='translateY(-50%)'
                            onClick={() => props.onOnlyYear(year)}
                          >
                            Only
                          </Button>
                        )}
                      </HStack>

                      {shown && (
                        <Stack gap={0} pl={2} pt={1}>
                          {vids.map(v => (
                            <HStack
                              key={v.id}
                              ref={props.selectedKind === 'video' && v.id === props.selectedId ? selectedRowRef : undefined}
                              as='button'
                              gap={2}
                              px={2}
                              py={1}
                              borderRadius='md'
                              textAlign='left'
                              bg={props.selectedKind === 'video' && v.id === props.selectedId ? 'bg.emphasized' : undefined}
                              fontWeight={props.selectedKind === 'video' && v.id === props.selectedId ? 'semibold' : undefined}
                              _hover={{ bg: 'bg.muted' }}
                              onClick={() => props.onSelectVideo(v)}
                            >
                              <VideoDisc shotType={v.shotType} color={v.color} />
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
            {props.creators.length > 0 && (
              <>
                <MasterCheckbox
                  label='All creators'
                  shown={shownCreators}
                  total={allCreatorIds.length}
                  onSetAll={hidden => props.onSetCreators(allCreatorIds, hidden)}
                />
                <Separator />
              </>
            )}
            {/* Multi-select Listbox (selected = shown). Plain click toggles a
                creator; shift-click toggles a range. The collection holds all
                creators; the search filters which rows render, and Ark keeps the
                selection across the full set, so a creator stays toggled even
                while filtered out by the search. */}
            <Listbox.Root
              collection={creatorCollection}
              selectionMode='multiple'
              value={shownCreatorIds}
              onValueChange={e => props.onSetShownCreators(e.value)}
              display='flex'
              flexDirection='column'
              flex='1'
              minH='0'
            >
              <Listbox.Content
                flex='1'
                minH='0'
                maxH='unset'
                gap={0}
                p={0}
                borderWidth='0'
                boxShadow='none'
                bg='transparent'
                css={thinScrollbar}
              >
                {creatorsFiltered.length === 0 ? (
                  <Text fontSize='sm' color='fg.muted' px={1} py={2}>
                    No creators match.
                  </Text>
                ) : (
                  creatorsFiltered.map(c => (
                    <Listbox.Item
                      key={c.id}
                      item={c}
                      position='relative'
                      gap={2}
                      ps={0}
                      pe={2}
                      py={0.5}
                      fontSize='xs'
                      css={creatorItemCss}
                    >
                      <Checkmark
                        size='sm'
                        checked={!props.hiddenCreators.has(c.id)}
                        flexShrink={0}
                        cursor='inherit'
                      />
                      <Circle
                        size='10px'
                        bg={c.color}
                        borderWidth='1px'
                        borderColor='whiteAlpha.700'
                        flexShrink={0}
                      />
                      <Listbox.ItemText flex='1' lineClamp={1}>
                        {c.name}
                      </Listbox.ItemText>
                      <Text fontSize='xs' color='fg.muted'>
                        {c.count}
                      </Text>
                      {(shownCreators > 1 || props.hiddenCreators.has(c.id)) && (
                        <Button
                          data-only=''
                          variant='subtle'
                          size='xs'
                          minW='0'
                          h='5'
                          px={1}
                          fontSize='2xs'
                          position='absolute'
                          insetEnd={0.5}
                          top='50%'
                          transform='translateY(-50%)'
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            props.onOnlyCreator(c.id);
                            e.currentTarget.blur();
                          }}
                        >
                          Only
                        </Button>
                      )}
                    </Listbox.Item>
                  ))
                )}
              </Listbox.Content>
            </Listbox.Root>
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Card.Root>
  );
}
