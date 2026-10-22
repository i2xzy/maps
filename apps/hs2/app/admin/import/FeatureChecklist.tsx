'use client';

import { useMemo, useState } from 'react';
import { Box, Checkbox, Heading, HStack, Input, Stack, Text } from '@chakra-ui/react';

import type { CatalogueRows } from '@/lib/import';

type Props = {
  features: CatalogueRows['features'];
  value: ReadonlyArray<string>;
  onChange: (ids: string[]) => void;
};

/**
 * The review step's feature picker as a persistent checklist (right column)
 * rather than a dropdown of chips: selected features sort to the top and stay
 * visible beside the video/map, and a search box filters the full catalogue to
 * tick more on or off.
 */
export function FeatureChecklist({ features, value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (id: string) => {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  // Filter by name, then sort selected-first so the pin's linked features are
  // always at the top of the list; alphabetical within each group.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = q ? features.filter((f) => f.name.toLowerCase().includes(q)) : features;
    return [...match].sort((a, b) => {
      const sa = selected.has(a.id) ? 0 : 1;
      const sb = selected.has(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
  }, [features, query, selected]);

  return (
    <Stack gap={3}>
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
      <Stack
        gap={0}
        overflowY='auto'
        maxH='calc(100vh - 12rem)'
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
              size='sm'
              checked={selected.has(f.id)}
              onCheckedChange={() => toggle(f.id)}
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
      </Stack>
    </Stack>
  );
}
