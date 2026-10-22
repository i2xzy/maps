'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Checkbox, Flex, Heading, HStack, Input, SegmentGroup, Text } from '@chakra-ui/react';

import { branchOf, type Branch, type CatalogueRows } from '@/lib/import';

type Feature = CatalogueRows['features'][number];

type BranchFilter = 'all' | Branch;

const BRANCH_SEGMENTS: ReadonlyArray<{ value: BranchFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'main', label: 'Main' },
  { value: 'spur', label: 'Spur' },
  { value: 'north', label: 'North' },
];

type Props = {
  features: CatalogueRows['features'];
  value: ReadonlyArray<string>;
  onChange: (ids: string[]) => void;
  /** Pixel height to match the media column; the list scrolls within it. */
  height?: number;
};

// Route order: by chainage ascending, unmapped (null) last, name as a tiebreak.
function byChainage(a: Feature, b: Feature): number {
  if (a.chainage === null && b.chainage === null) return a.name.localeCompare(b.name);
  if (a.chainage === null) return 1;
  if (b.chainage === null) return -1;
  if (a.chainage !== b.chainage) return a.chainage - b.chainage;
  return a.name.localeCompare(b.name);
}

/**
 * The review step's feature picker as a persistent checklist (right column)
 * beside the video/map, rather than a dropdown of chips. The full catalogue is
 * listed in route (chainage) order; the list scrolls to the first selected
 * feature on mount so the pin's linked features are in view. A search box
 * filters it to tick more on or off.
 */
export function FeatureChecklist({ features, value, onChange, height }: Props) {
  const [query, setQuery] = useState('');
  // Start on the branch of the preselected features when they all share one
  // (a video is almost always a single branch), else show everything. Runs once
  // per pin since the card remounts; the operator can still switch.
  const [branch, setBranch] = useState<BranchFilter>(() => {
    const branchById = new Map(features.map((f) => [f.id, branchOf(f.routeElementId)]));
    const present = new Set(value.map((id) => branchById.get(id)).filter((b) => b !== undefined));
    return present.size === 1 ? [...present][0]! : 'all';
  });
  const selected = useMemo(() => new Set(value), [value]);
  const listRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = features.filter(
      (f) =>
        (branch === 'all' || branchOf(f.routeElementId) === branch) &&
        (q === '' || f.name.toLowerCase().includes(q)),
    );
    return [...match].sort(byChainage);
  }, [features, query, branch]);

  // On mount (the card remounts per pin), scroll so the first selected feature
  // is at the top of the list — it sits in chainage order, not floated up.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>('[data-selected="true"]');
    if (row) list.scrollTop = row.offsetTop;
  }, []);

  return (
    <Flex direction='column' h={height ? `${height}px` : 'auto'} minH='0' gap={3}>
      <HStack justify='space-between' align='baseline'>
        <Heading size='sm'>Linked features</Heading>
        <Text fontSize='xs' color='fg.muted'>
          {value.length} selected
        </Text>
      </HStack>
      <SegmentGroup.Root
        size='xs'
        value={branch}
        onValueChange={(e) => setBranch(e.value as BranchFilter)}
      >
        <SegmentGroup.Indicator />
        <SegmentGroup.Items items={[...BRANCH_SEGMENTS]} />
      </SegmentGroup.Root>
      <Input
        size='sm'
        placeholder='Search features…'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Flex
        ref={listRef}
        direction='column'
        position='relative'
        flex='1'
        minH='0'
        maxH={height ? undefined : '24rem'}
        overflowY='auto'
        borderWidth='1px'
        borderColor='border'
        borderRadius='md'
      >
        {shown.length === 0 ? (
          <Text fontSize='sm' color='fg.muted' p={3}>
            No features match that search.
          </Text>
        ) : (
          shown.map((f) => (
            <Checkbox.Root
              key={f.id}
              data-selected={selected.has(f.id)}
              size='sm'
              checked={selected.has(f.id)}
              onCheckedChange={() => toggle(f.id)}
              display='flex'
              alignItems='center'
              width='full'
              px={3}
              py={2}
              gap={2.5}
              cursor='pointer'
              _hover={{ bg: 'bg.muted' }}
              borderBottomWidth='1px'
              borderColor='border'
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control cursor='inherit' />
              <Checkbox.Label flex='1' cursor='inherit' fontWeight='normal'>
                <Box lineHeight='1.3'>
                  <Text fontSize='sm'>{f.name}</Text>
                  {f.routeElementId && (
                    <Text fontSize='xs' color='fg.muted'>
                      {f.routeElementId}
                    </Text>
                  )}
                </Box>
              </Checkbox.Label>
            </Checkbox.Root>
          ))
        )}
      </Flex>
    </Flex>
  );
}
