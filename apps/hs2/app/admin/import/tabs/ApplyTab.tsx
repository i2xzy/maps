'use client';

import { Alert, Button, HStack, Separator, Stack, Text } from '@chakra-ui/react';

import type { ImportPlan } from '@/lib/import';
import type { ApplyResult } from '@/lib/import-server/commit';

type Props = {
  summary: ImportPlan['summary'];
  onApply: () => void;
  isApplying: boolean;
  result: ApplyResult | null;
  error: string | null;
};

function Row({ label, value }: { label: string; value: number }) {
  return (
    <HStack justify='space-between'>
      <Text color='fg.muted'>{label}</Text>
      <Text fontWeight='medium'>{value}</Text>
    </HStack>
  );
}

export function ApplyTab({ summary, onApply, isApplying, result, error }: Props) {
  const blockedTotal =
    summary.blocked['no-url'] + summary.blocked['no-creator'] + summary.blocked['no-shot-type'];

  return (
    <Stack gap={4} pt={4} maxW='lg'>
      <Stack gap={2}>
        <Row label='Media to insert' value={summary.insert} />
        <Row label='Media to relink' value={summary.relink} />
        <Row label='Feature links to add' value={summary.linksPlanned} />
        <Separator />
        <Row label='Blocked (not written)' value={blockedTotal} />
      </Stack>

      {blockedTotal > 0 && (
        <Alert.Root status='warning'>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{blockedTotal} pins are blocked and will not be written.</Alert.Title>
            <Alert.Description>
              Resolve them in the Creators and Pins tabs, or apply now and import them later.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <Button
        alignSelf='start'
        loading={isApplying}
        disabled={summary.insert === 0 && summary.relink === 0 && summary.linksPlanned === 0}
        onClick={onApply}
      >
        Apply import
      </Button>

      {error && (
        <Alert.Root status='error'>
          <Alert.Indicator />
          <Alert.Title>{error}</Alert.Title>
        </Alert.Root>
      )}

      {result && (
        <Alert.Root status='success'>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Import applied.</Alert.Title>
            <Alert.Description>
              Inserted {result.inserted}, relinked {result.reused}, links added {result.linksAdded},
              skipped {result.skipped}.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </Stack>
  );
}
