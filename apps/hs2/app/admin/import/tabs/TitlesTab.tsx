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
} from '@chakra-ui/react';

import type { CatalogueRows, Decision, UnmatchedCandidate } from '@/lib/import';

import { CopyChip } from './CopyChip';

type Props = {
  candidates: ReadonlyArray<UnmatchedCandidate>;
  features: CatalogueRows['features'];
  onAddAlias: (alias: string, featureNames: string[]) => Promise<void>;
  upsertDecision: (d: Decision) => void;
};

function CandidateRow({ entry, features, onAddAlias, upsertDecision }: {
  entry: UnmatchedCandidate;
  features: CatalogueRows['features'];
  onAddAlias: (alias: string, featureNames: string[]) => Promise<void>;
  upsertDecision: (d: Decision) => void;
}) {
  const [target, setTarget] = useState(entry.closest?.feature.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixTitle = () => {
    if (target) upsertDecision({ kind: 'fixCandidate', from: entry.text, to: target });
  };

  const aliasToTarget = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await onAddAlias(entry.text, [target]);
    } catch {
      setError('Could not save the alias. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card.Root variant='outline'>
      <Card.Body>
        <Stack gap={3}>
          <HStack justify='space-between' align='start'>
            <Stack gap={0}>
              <Text fontWeight='semibold'>{entry.text}</Text>
              <Text fontSize='sm' color='fg.muted'>
                {entry.pinCount} pins
                {entry.closest &&
                  ` · closest: ${entry.closest.feature.name} (${Math.round(entry.closest.similarity * 100)}%)`}
              </Text>
            </Stack>
            <Badge colorPalette={entry.verdict === 'typo' ? 'orange' : 'gray'}>
              {entry.verdict === 'typo' ? 'Likely typo' : 'Alias or missing'}
            </Badge>
          </HStack>

          {entry.locators.length > 0 && (
            <HStack gap={2} flexWrap='wrap' align='center'>
              <Text fontSize='xs' color='fg.muted'>
                Find in map:
              </Text>
              {entry.locators.map((loc, i) => (
                <CopyChip
                  key={`${loc.videoId ?? loc.title}-${i}`}
                  value={loc.videoId ?? loc.title}
                  label={loc.videoId ?? loc.title}
                />
              ))}
            </HStack>
          )}

          <HStack gap={3} flexWrap='wrap' align='end'>
            <Field.Root width='auto'>
              <Field.Label fontSize='xs'>Target feature</Field.Label>
              <NativeSelect.Root size='sm' width='300px'>
                <NativeSelect.Field value={target} onChange={(e) => setTarget(e.currentTarget.value)}>
                  <option value=''>Select a feature…</option>
                  {features.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Button size='sm' variant='subtle' disabled={target === ''} onClick={fixTitle}>
              Fix title to this
            </Button>
            <Button
              size='sm'
              variant='ghost'
              loading={busy}
              disabled={target === ''}
              onClick={() => void aliasToTarget()}
            >
              Add as alias
            </Button>
          </HStack>
          {error && <Text fontSize='sm' color='fg.error'>{error}</Text>}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

export function TitlesTab({ candidates, features, onAddAlias, upsertDecision }: Props) {
  if (candidates.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>Every title resolves to a feature</EmptyState.Title>
          <EmptyState.Description>No titles need attention.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Stack gap={3} pt={4}>
      {candidates.map((entry) => (
        <CandidateRow
          key={entry.text}
          entry={entry}
          features={features}
          onAddAlias={onAddAlias}
          upsertDecision={upsertDecision}
        />
      ))}
    </Stack>
  );
}
