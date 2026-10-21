'use client';

import { Badge, Card, EmptyState, HStack, Stack, Text } from '@chakra-ui/react';

import type { ParseWarning, PinPlan } from '@/lib/import';

import { CopyChip } from './CopyChip';

function describeWarning(w: ParseWarning): string {
  switch (w.kind) {
    case 'non-url-link':
      return `The Link field isn't a URL: “${w.link}”`;
    case 'no-youtube-id':
      return `Couldn't read a video id from the URL`;
    case 'unmapped-shot-type':
      return w.raw ? `Unrecognised shot type: “${w.raw}”` : 'No shot type set';
    case 'unparsed-date':
      return `Couldn't parse the ${w.field} date: “${w.raw}”`;
    case 'date-from-title': {
      const problem = /\d{4}/.test(w.raw) ? "couldn't be parsed" : 'is missing the year';
      return `The date field “${w.raw}” ${problem}, so the title's date was used instead`;
    }
    case 'misplaced-date':
      return `The ${w.field} field holds a date (“${w.value}”) — looks swapped`;
    case 'channel-is-url':
      return `The channel field holds a URL (“${w.value}”)`;
  }
}

// A source-data block worth flagging. no-creator is a resolution task (Creators
// tab), not a file error, so it returns null and is handled there.
function blockNote(plan: Extract<PinPlan, { kind: 'blocked' }>): string | null {
  switch (plan.reason.kind) {
    case 'no-url':
      return 'Not imported: missing or invalid video URL';
    case 'no-shot-type':
      return 'Not imported: shot type could not be determined';
    case 'bad-channel':
      return `Not imported: the channel holds a ${plan.reason.why === 'url' ? 'URL' : 'date'}`;
    case 'no-creator':
      return null;
  }
}

type Severity = 'blocked' | 'duplicate' | 'warning';
export type PinIssue = { plan: PinPlan; notes: string[]; severity: Severity };

const BADGE: Record<Severity, { color: string; label: string }> = {
  blocked: { color: 'red', label: 'Not imported' },
  duplicate: { color: 'orange', label: 'Duplicate URL' },
  warning: { color: 'yellow', label: 'Warning' },
};

export function collectIssues(pins: ReadonlyArray<PinPlan>): PinIssue[] {
  const out: PinIssue[] = [];
  for (const plan of pins) {
    const notes = plan.warnings.map(describeWarning);
    let severity: Severity = 'warning';
    if (plan.kind === 'blocked') {
      const note = blockNote(plan);
      if (note !== null) {
        notes.unshift(note);
        severity = 'blocked';
      }
    } else if (plan.kind === 'skipped' && plan.reason.kind === 'duplicate-url') {
      const firstOrdinal = plan.reason.firstOrdinal;
      const first = pins.find((p) => p.pin.ordinal === firstOrdinal);
      const where = first ? `“${first.pin.title}”` : `pin #${firstOrdinal}`;
      notes.unshift(
        `Duplicate video URL — the same URL is on ${where}. This pin won't import; only its ` +
          'feature links merge in. Give one pin its “?t=” timestamp URL in the map so both import.',
      );
      severity = 'duplicate';
    }
    if (notes.length > 0) out.push({ plan, notes, severity });
  }
  return out;
}

export function IssuesTab({ pins }: { pins: ReadonlyArray<PinPlan> }) {
  const issues = collectIssues(pins);

  if (issues.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>No input-file issues</EmptyState.Title>
          <EmptyState.Description>Every pin parsed cleanly.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Stack gap={2} pt={4} maxH='70vh' overflowY='auto'>
      <Text fontSize='sm' color='fg.muted'>
        {issues.length} pin{issues.length === 1 ? '' : 's'} with problems in the source file. Fix them
        in Google My Maps and re-export.
      </Text>
      {issues.map(({ plan, notes, severity }) => (
        <Card.Root key={plan.pin.ordinal} variant='outline' size='sm'>
          <Card.Body>
            <Stack gap={2}>
              <HStack justify='space-between' align='start' gap={3}>
                <Text fontWeight='medium' lineClamp={1}>
                  {plan.pin.title || '(untitled)'}
                </Text>
                <Badge colorPalette={BADGE[severity].color}>{BADGE[severity].label}</Badge>
              </HStack>
              <Stack gap={0.5}>
                {notes.map((n) => (
                  <Text key={n} fontSize='sm' color='fg.muted'>
                    • {n}
                  </Text>
                ))}
              </Stack>
              <HStack gap={2} align='center'>
                <Text fontSize='xs' color='fg.muted'>
                  Find in map:
                </Text>
                <CopyChip value={plan.pin.youtubeId ?? plan.pin.title} />
              </HStack>
            </Stack>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  );
}
