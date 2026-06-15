'use client';

/**
 * Standalone floating search for the map (Google-Maps style): a search box that
 * sits over the map, separate from the control panel, with a dropdown of
 * matching structures. Picking one flies to it and opens its detail panel.
 * Self-contained — owns its own query/open state.
 */
import { useState } from 'react';
import { Box, Card, Input, InputGroup, HStack, Text } from '@chakra-ui/react';
import { LuSearch } from 'react-icons/lu';

import { FeatureIcon } from '@/components/feature/feature-icon';
import type { SearchResult } from '@/components/map/MapControlPanel';

const MAX_RESULTS = 12;

export default function MapSearch({
  features,
  onSelect,
  left,
}: {
  features: SearchResult[];
  onSelect: (r: SearchResult) => void;
  /** Left inset so the bar clears the control panel (open or collapsed). */
  left: { base: string; sm: string };
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const results = q
    ? features.filter(f => f.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS)
    : [];

  const pick = (r: SearchResult) => {
    onSelect(r);
    setQuery('');
    setOpen(false);
  };

  return (
    <Box
      position='absolute'
      top={3}
      left={left}
      w={{ base: 'calc(100% - 68px)', sm: '380px' }}
      zIndex={5}
    >
      <Card.Root variant='elevated' borderRadius='lg'>
        <InputGroup startElement={<LuSearch />}>
          <Input
            size='md'
            border='none'
            placeholder='Search structures'
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setQuery('');
                setOpen(false);
              }
            }}
          />
        </InputGroup>
      </Card.Root>

      {open && q && (
        <Card.Root
          mt={1}
          variant='elevated'
          borderRadius='lg'
          maxH='320px'
          overflowY='auto'
          py={1}
        >
          {results.length === 0 ? (
            <Text fontSize='sm' color='fg.muted' px={3} py={2}>
              No structures match.
            </Text>
          ) : (
            results.map(r => (
              <HStack
                key={r.id}
                as='button'
                w='full'
                gap={2}
                px={3}
                py={2}
                textAlign='left'
                _hover={{ bg: 'bg.muted' }}
                // onMouseDown (not onClick) so it fires before the input's
                // onBlur closes the dropdown.
                onMouseDown={() => pick(r)}
              >
                <FeatureIcon type={r.type} name={r.name} />
                <Text fontSize='sm' lineClamp={1}>
                  {r.name}
                </Text>
              </HStack>
            ))
          )}
        </Card.Root>
      )}
    </Box>
  );
}
