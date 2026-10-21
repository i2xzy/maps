'use client';

import { HStack, Separator, Stack, Text } from '@chakra-ui/react';

import type { ImportPlan } from '@/lib/import';

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <HStack justify='space-between'>
      <Text color='fg.muted'>{label}</Text>
      <Text fontWeight='medium'>{value}</Text>
    </HStack>
  );
}

export function SummaryTab({ plan, isDeriving }: { plan: ImportPlan; isDeriving: boolean }) {
  const { summary } = plan;
  const warningCount = plan.pins.reduce((n, p) => n + p.warnings.length, 0);
  const blockedTotal =
    summary.blocked['no-url'] + summary.blocked['no-creator'] + summary.blocked['no-shot-type'];

  return (
    <Stack gap={3} pt={4} maxW='lg'>
      <Row label='New media to insert' value={summary.insert} />
      <Row label='Existing media to relink' value={summary.relink} />
      <Row label='Feature links to add' value={summary.linksPlanned} />
      <Separator />
      <Row label='Skipped pins' value={summary.skipped} />
      <Row label='Duplicate urls merged' value={summary.duplicateUrls} />
      <Separator />
      <Row label='Blocked: no url' value={summary.blocked['no-url']} />
      <Row label='Blocked: no creator' value={summary.blocked['no-creator']} />
      <Row label='Blocked: no shot type' value={summary.blocked['no-shot-type']} />
      <Row label='Blocked total' value={blockedTotal} />
      <Separator />
      <Row label='Parse warnings' value={warningCount} />
      <Text fontSize='sm' color='fg.muted'>
        {isDeriving ? 'Re-deriving after your last change…' : 'Plan is up to date with your decisions.'}
      </Text>
    </Stack>
  );
}
