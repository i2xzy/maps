'use client';

import { useState } from 'react';
import { Badge, Button, Card, Field, HStack, Input, Stack, Text } from '@chakra-ui/react';

import {
  decisionRef,
  isoDateSchema,
  type Decision,
  type DecisionRef,
  type IsoDate,
  type PinPlan,
} from '@/lib/import';

type Props = {
  pins: ReadonlyArray<PinPlan>;
  upsertDecision: (d: Decision) => void;
  removeDecision: (ref: DecisionRef) => void;
};

const KIND_COLOR: Record<PinPlan['kind'], string> = {
  insert: 'green',
  relink: 'blue',
  blocked: 'red',
  skipped: 'gray',
};

function toIso(value: string): IsoDate | null {
  if (value === '') return null;
  const parsed = isoDateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function PinRow({ plan, upsertDecision, removeDecision }: {
  plan: PinPlan;
  upsertDecision: (d: Decision) => void;
  removeDecision: (ref: DecisionRef) => void;
}) {
  const url = plan.pin.url;
  const [showDates, setShowDates] = useState(false);
  const [published, setPublished] = useState<string>(plan.pin.publishedAt ?? '');
  const [recorded, setRecorded] = useState<string>(plan.pin.recordedDate ?? '');

  const isDecidedSkip = plan.kind === 'skipped' && plan.reason.kind === 'decided';

  const skip = () => {
    if (url) upsertDecision({ kind: 'skipPin', url, reason: 'Skipped in review' });
  };
  const unskip = () => {
    if (url) removeDecision(decisionRef({ kind: 'skipPin', url, reason: '' }));
  };
  const applyDates = () => {
    if (!url) return;
    upsertDecision({
      kind: 'overrideDates',
      url,
      publishedAt: toIso(published),
      recordedDate: toIso(recorded),
    });
    setShowDates(false);
  };

  return (
    <Card.Root variant='outline' size='sm'>
      <Card.Body>
        <Stack gap={2}>
          <HStack justify='space-between' align='start' gap={3}>
            <Stack gap={0} flex='1' minW='0'>
              <Text fontWeight='medium' lineClamp={1}>
                {plan.title || '(untitled)'}
              </Text>
              <Text fontSize='xs' color='fg.muted'>
                #{plan.pin.ordinal}
                {plan.pin.channel && ` · ${plan.pin.channel}`}
              </Text>
            </Stack>
            <HStack gap={2}>
              {plan.warnings.length > 0 && (
                <Badge colorPalette='yellow'>{plan.warnings.length} warn</Badge>
              )}
              <Badge colorPalette={KIND_COLOR[plan.kind]}>{plan.kind}</Badge>
            </HStack>
          </HStack>

          {url && (
            <HStack gap={2}>
              {isDecidedSkip ? (
                <Button size='xs' variant='ghost' onClick={unskip}>
                  Unskip
                </Button>
              ) : (
                <Button size='xs' variant='ghost' colorPalette='gray' onClick={skip}>
                  Skip
                </Button>
              )}
              <Button size='xs' variant='ghost' onClick={() => setShowDates((v) => !v)}>
                {showDates ? 'Cancel' : 'Override dates'}
              </Button>
            </HStack>
          )}

          {showDates && url && (
            <HStack gap={3} align='end' flexWrap='wrap'>
              <Field.Root width='auto'>
                <Field.Label fontSize='xs'>Published</Field.Label>
                <Input
                  size='sm'
                  type='date'
                  value={published}
                  onChange={(e) => setPublished(e.target.value)}
                />
              </Field.Root>
              <Field.Root width='auto'>
                <Field.Label fontSize='xs'>Recorded</Field.Label>
                <Input
                  size='sm'
                  type='date'
                  value={recorded}
                  onChange={(e) => setRecorded(e.target.value)}
                />
              </Field.Root>
              <Button size='sm' variant='subtle' onClick={applyDates}>
                Apply dates
              </Button>
            </HStack>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

export function PinsTab({ pins, upsertDecision, removeDecision }: Props) {
  return (
    <Stack gap={2} pt={4} maxH='70vh' overflowY='auto'>
      {pins.map((plan) => (
        <PinRow
          key={`${plan.pin.ordinal}`}
          plan={plan}
          upsertDecision={upsertDecision}
          removeDecision={removeDecision}
        />
      ))}
    </Stack>
  );
}
