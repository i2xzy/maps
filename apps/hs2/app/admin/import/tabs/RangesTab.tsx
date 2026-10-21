'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  Wrap,
} from '@chakra-ui/react';

import {
  decisionRef,
  type Decision,
  type DecisionRef,
  type RangeWork,
  type SpanChoice,
  type SpanPlan,
} from '@/lib/import';

type Props = {
  ranges: ReadonlyArray<RangeWork>;
  upsertDecision: (d: Decision) => void;
  removeDecision: (ref: DecisionRef) => void;
};

type Mode = SpanChoice['kind'];

function SpanPreview({ span }: { span: SpanPlan }) {
  if (span.kind === 'manual') {
    return (
      <Text fontSize='sm' color='fg.muted'>
        Manual · {span.reason === 'admin' ? 'set by you' : 'ground/vehicle, not auto-spanned'}
      </Text>
    );
  }
  if (span.features.length === 0) {
    return (
      <Text fontSize='sm' color='fg.muted'>
        No features resolved — left unlinked.
      </Text>
    );
  }
  return (
    <Wrap gap={1}>
      {span.features.map((f) => (
        <Badge key={f.id} colorPalette={span.kind === 'unresolved' ? 'orange' : 'green'}>
          {f.name}
        </Badge>
      ))}
    </Wrap>
  );
}

function RangeRow({ entry, upsertDecision, removeDecision }: {
  entry: RangeWork;
  upsertDecision: (d: Decision) => void;
  removeDecision: (ref: DecisionRef) => void;
}) {
  const [mode, setMode] = useState<Mode>(entry.choice.kind);
  const [routePrefix, setRoutePrefix] = useState(
    entry.choice.kind === 'auto' ? (entry.choice.routePrefix ?? '') : '',
  );
  const [explicit, setExplicit] = useState(
    entry.choice.kind === 'explicit' ? entry.choice.featureNames.join('\n') : '',
  );

  const apply = () => {
    let choice: SpanChoice;
    switch (mode) {
      case 'auto':
        choice = { kind: 'auto', routePrefix: routePrefix.trim() === '' ? null : routePrefix.trim() };
        break;
      case 'endpointsOnly':
        choice = { kind: 'endpointsOnly' };
        break;
      case 'explicit':
        choice = {
          kind: 'explicit',
          featureNames: explicit.split('\n').map((s) => s.trim()).filter((s) => s !== ''),
        };
        break;
      case 'manual':
        choice = { kind: 'manual' };
        break;
    }
    upsertDecision({ kind: 'span', from: entry.from, to: entry.to, choice });
  };

  const reset = () => {
    removeDecision(decisionRef({ kind: 'span', from: entry.from, to: entry.to, choice: { kind: 'manual' } }));
  };

  return (
    <Card.Root variant='outline'>
      <Card.Body>
        <Stack gap={3}>
          <HStack justify='space-between' align='start'>
            <Stack gap={0}>
              <Text fontWeight='semibold'>
                {entry.from} → {entry.to}
              </Text>
              <Text fontSize='sm' color='fg.muted'>
                {entry.pinCount} pins
                {entry.shotTypes.length > 0 && ` · ${entry.shotTypes.join(', ')}`}
              </Text>
            </Stack>
          </HStack>

          <SpanPreview span={entry.span} />

          <HStack gap={3} flexWrap='wrap' align='end'>
            <Field.Root width='auto'>
              <Field.Label fontSize='xs'>Resolve by</Field.Label>
              <NativeSelect.Root size='sm' width='200px'>
                <NativeSelect.Field value={mode} onChange={(e) => setMode(e.currentTarget.value as Mode)}>
                  <option value='auto'>Auto (chainage span)</option>
                  <option value='endpointsOnly'>Endpoints only</option>
                  <option value='explicit'>Explicit list</option>
                  <option value='manual'>Manual (leave unlinked)</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            {mode === 'auto' && (
              <Field.Root width='auto'>
                <Field.Label fontSize='xs'>Route prefix (optional)</Field.Label>
                <Input
                  size='sm'
                  width='140px'
                  value={routePrefix}
                  onChange={(e) => setRoutePrefix(e.target.value)}
                  placeholder='e.g. B- or N-'
                />
              </Field.Root>
            )}
            <Button size='sm' variant='subtle' onClick={apply}>
              Apply
            </Button>
            <Button size='sm' variant='ghost' colorPalette='gray' onClick={reset}>
              Reset to default
            </Button>
          </HStack>

          {mode === 'explicit' && (
            <Field.Root>
              <Field.Label fontSize='xs'>Feature names, one per line</Field.Label>
              <Textarea
                size='sm'
                rows={4}
                value={explicit}
                onChange={(e) => setExplicit(e.target.value)}
                placeholder={'Aston Church Road Overbridge\nMarston Road Overbridge'}
              />
            </Field.Root>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

export function RangesTab({ ranges, upsertDecision, removeDecision }: Props) {
  if (ranges.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>No ranges in this layer</EmptyState.Title>
          <EmptyState.Description>No &quot;A to B&quot; titles were found.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Stack gap={3} pt={4}>
      {ranges.map((entry) => (
        <RangeRow
          key={`${entry.from}\u0000${entry.to}`}
          entry={entry}
          upsertDecision={upsertDecision}
          removeDecision={removeDecision}
        />
      ))}
    </Stack>
  );
}
