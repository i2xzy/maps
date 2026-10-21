'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  HStack,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  Wrap,
} from '@chakra-ui/react';

import {
  decisionRef,
  type Branch,
  type Decision,
  type DecisionRef,
  type RangeWork,
  type SpanChoice,
  type SpanPlan,
} from '@/lib/import';

const BRANCH_LABELS: Record<Branch, string> = {
  main: 'Main Line',
  spur: 'Birmingham Spur',
  north: 'North Chord',
};

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
  const [branch, setBranch] = useState<Branch | ''>(
    entry.choice.kind === 'auto' ? (entry.choice.branch ?? '') : '',
  );
  const resolvedNames = entry.span.kind === 'manual' ? [] : entry.span.features.map((f) => f.name);
  const [explicit, setExplicit] = useState(
    (entry.choice.kind === 'explicit' ? entry.choice.featureNames : resolvedNames).join('\n'),
  );

  const apply = () => {
    let choice: SpanChoice;
    switch (mode) {
      case 'auto':
        choice = { kind: 'auto', branch: branch === '' ? null : branch };
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
              <Field.Label fontSize='xs'>How to link</Field.Label>
              <NativeSelect.Root size='sm' width='220px'>
                <NativeSelect.Field value={mode} onChange={(e) => setMode(e.currentTarget.value as Mode)}>
                  <option value='auto'>Auto — every feature between</option>
                  <option value='endpointsOnly'>Endpoints only — just the two</option>
                  <option value='explicit'>Explicit list — type the set</option>
                  <option value='manual'>Manual — leave unlinked</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            {mode === 'auto' && entry.branchChoiceNeeded && (
              <Field.Root width='auto'>
                <Field.Label fontSize='xs'>Limit Auto to a branch</Field.Label>
                <NativeSelect.Root size='sm' width='170px'>
                  <NativeSelect.Field
                    value={branch}
                    onChange={(e) => setBranch(e.currentTarget.value as Branch | '')}
                  >
                    <option value=''>Whole route</option>
                    {entry.branchesPresent.map((b) => (
                      <option key={b} value={b}>
                        {BRANCH_LABELS[b]}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
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
              <Field.HelperText fontSize='xs'>
                Prefilled from the auto result. Add or remove lines; unknown names are ignored.
              </Field.HelperText>
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
      <Text fontSize='sm' color='fg.muted'>
        A range title (“A to B”) links every feature between its two endpoints. Auto follows the
        route&apos;s chainage order, Endpoints only links the two named features, Explicit list lets
        you edit the exact set (prefilled from Auto), and Manual leaves it unlinked. A range that
        crosses the junction should use the Explicit list.
      </Text>
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
