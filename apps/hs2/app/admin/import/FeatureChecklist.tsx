'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Checkbox, Flex, Heading, HStack, Input, Text } from '@chakra-ui/react';

import type { CatalogueRows } from '@/lib/import';

type Feature = CatalogueRows['features'][number];

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
  const selected = useMemo(() => new Set(value), [value]);
  const listRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = q ? features.filter((f) => f.name.toLowerCase().includes(q)) : features;
    return [...match].sort(byChainage);
  }, [features, query]);

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
              width='full'
              px={3}
              py={2}
              gap={3}
              cursor='pointer'
              _hover={{ bg: 'bg.muted' }}
              borderBottomWidth='1px'
              borderColor='border'
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control cursor='inherit' />
              <Checkbox.Label flex='1' cursor='inherit'>
                <Box>
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
