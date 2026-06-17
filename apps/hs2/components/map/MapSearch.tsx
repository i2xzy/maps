'use client';

/**
 * Standalone floating search for the map (Google-Maps style): a search box that
 * sits over the map, separate from the control panel, with a dropdown of
 * matching structures AND videos. Picking one flies to it and opens its detail
 * panel (feature → FeatureDetailPanel, video → MediaDetailPanel).
 *
 * Built on Chakra's Combobox so open/close, keyboard navigation, filtering and
 * a11y are handled by the component rather than hand-rolled state.
 */
import { useState } from 'react';
import {
  Box,
  Card,
  Combobox,
  HStack,
  InputGroup,
  Portal,
  Text,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import { LuSearch } from 'react-icons/lu';

import { FeatureIcon } from '@/components/feature/feature-icon';
import { ShotTypeIcon } from '@/components/map/shot-type-config';
import type { SearchResult, VideoItem } from '@/components/map/MapControlPanel';

const MAX_RESULTS = 12;

/**
 * A searchable map entity: a structure (feature) or a video. `search` is the
 * haystack the query matches against — built by the caller (MapView), where
 * creator names live, so videos are findable by title, creator, YouTube id and
 * shot type, not just title.
 */
export type MapSearchItem =
  | { kind: 'feature'; result: SearchResult; search: string }
  | {
      kind: 'video';
      video: VideoItem;
      search: string;
      creator: string | null;
    };

// kind-prefixed so a feature and a video can never collide on value.
const itemId = (it: MapSearchItem) =>
  it.kind === 'feature' ? `feature:${it.result.id}` : `video:${it.video.id}`;
// Shown in the row.
const itemLabel = (it: MapSearchItem) =>
  it.kind === 'feature' ? it.result.name : it.video.title;
// Matched against by the filter (not shown).
const itemSearch = (it: MapSearchItem) => it.search;

export default function MapSearch({
  items,
  onSelect,
  left,
}: {
  items: MapSearchItem[];
  onSelect: (item: MapSearchItem) => void;
  /** Left inset so the bar clears the control panel (open or collapsed). */
  left: { base: string; sm: string };
}) {
  const [inputValue, setInputValue] = useState('');
  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter } = useListCollection<MapSearchItem>({
    initialItems: items,
    itemToString: itemSearch,
    itemToValue: itemId,
    filter: contains,
    limit: MAX_RESULTS,
  });

  return (
    <Box
      position='absolute'
      top={3}
      left={left}
      w={{ base: 'calc(100% - 68px)', sm: '380px' }}
      zIndex={5}
    >
      <Combobox.Root
        collection={collection}
        inputValue={inputValue}
        onInputValueChange={e => {
          setInputValue(e.inputValue);
          filter(e.inputValue);
        }}
        // Fire the action on pick, then reset — this is a search-and-go box, it
        // doesn't retain a selection.
        onValueChange={e => {
          const picked = items.find(i => itemId(i) === e.value[0]);
          if (picked) onSelect(picked);
          setInputValue('');
          filter('');
        }}
        // Don't dump everything on focus — only open while typing.
        openOnClick={false}
        // Clear the box after a pick (search-and-go), not keep the label.
        selectionBehavior='clear'
        positioning={{ sameWidth: true }}
      >
        <Card.Root variant='elevated' borderRadius='lg'>
          <Combobox.Control>
            <InputGroup startElement={<LuSearch />}>
              <Combobox.Input
                border='none'
                placeholder='Search structures and videos'
              />
            </InputGroup>
          </Combobox.Control>
        </Card.Root>

        <Portal>
          <Combobox.Positioner>
            <Combobox.Content maxH='320px' overflowY='auto'>
              <Combobox.Empty px={3} py={2} fontSize='sm' color='fg.muted'>
                No matches.
              </Combobox.Empty>
              {collection.items.map(item => (
                <Combobox.Item item={item} key={itemId(item)}>
                  <HStack gap={2} minW={0}>
                    {item.kind === 'video' ? (
                      <ShotTypeIcon shotType={item.video.shotType} />
                    ) : (
                      <FeatureIcon
                        type={item.result.type}
                        name={item.result.name}
                      />
                    )}
                    <Box minW={0}>
                      <Text fontSize='sm' lineClamp={1}>
                        {itemLabel(item)}
                      </Text>
                      {item.kind === 'video' && item.creator && (
                        <Text fontSize='xs' color='fg.muted' lineClamp={1}>
                          {item.creator}
                        </Text>
                      )}
                    </Box>
                  </HStack>
                </Combobox.Item>
              ))}
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Box>
  );
}
