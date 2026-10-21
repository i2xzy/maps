'use client';

import { useMemo } from 'react';
import {
  Badge,
  Combobox,
  HStack,
  Icon,
  Portal,
  Stack,
  Text,
  Wrap,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';

import type { CatalogueRows } from '@/lib/import';

type FeatureItem = { label: string; value: string };

type Props = {
  features: CatalogueRows['features'];
  value: ReadonlyArray<string>;
  onChange: (ids: string[]) => void;
};

export function FeatureCombobox({ features, value, onChange }: Props) {
  const nameById = useMemo(() => new Map(features.map((f) => [f.id, f.name])), [features]);
  const items = useMemo<FeatureItem[]>(
    () => features.map((f) => ({ label: f.name, value: f.id })),
    [features],
  );

  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter } = useListCollection<FeatureItem>({
    initialItems: items,
    filter: contains,
    limit: 100,
  });

  return (
    <Stack gap={2}>
      <Combobox.Root
        multiple
        closeOnSelect={false}
        openOnClick
        value={[...value]}
        collection={collection}
        onValueChange={(d) => onChange(d.value)}
        onInputValueChange={(d) => filter(d.inputValue)}
      >
        <Combobox.Label fontSize='sm'>Linked features</Combobox.Label>
        <Combobox.Control>
          <Combobox.Input placeholder='Search features by name…' />
          <Combobox.IndicatorGroup>
            <Combobox.ClearTrigger />
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content maxH='18rem' overflowY='auto'>
              <Combobox.Empty>No features match that search.</Combobox.Empty>
              {collection.items.map((item) => (
                <Combobox.Item key={item.value} item={item}>
                  <Combobox.ItemText>{item.label}</Combobox.ItemText>
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              ))}
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>

      {value.length === 0 ? (
        <Text fontSize='xs' color='fg.muted'>
          No features linked yet.
        </Text>
      ) : (
        <Wrap gap={2}>
          {value.map((id) => (
            <Badge key={id} colorPalette='blue' variant='subtle'>
              <HStack gap={1}>
                <Text>{nameById.get(id) ?? id}</Text>
                <Icon
                  cursor='pointer'
                  aria-label='Remove feature'
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  <LuX />
                </Icon>
              </HStack>
            </Badge>
          ))}
        </Wrap>
      )}
    </Stack>
  );
}
