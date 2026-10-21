'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Field,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';

import type {
  CatalogueRows,
  CreatorId,
  CreatorRef,
  Decision,
  MissingCreator,
  PinPlan,
  Url,
} from '@/lib/import';

type CreatorInput = {
  displayName: string;
  url: string;
  platform?: string;
  externalId: string;
};

type Props = {
  missingCreators: ReadonlyArray<MissingCreator>;
  pins: ReadonlyArray<PinPlan>;
  creators: CatalogueRows['creators'];
  onCreateCreator: (input: CreatorInput) => Promise<CreatorRef>;
  upsertDecision: (d: Decision) => void;
};

function urlsForChannel(pins: ReadonlyArray<PinPlan>, channel: string): Url[] {
  const key = channel.trim().toLowerCase();
  const urls: Url[] = [];
  for (const p of pins) {
    if (p.kind === 'blocked' && p.reason.kind === 'no-creator') {
      if (p.reason.channel.trim().toLowerCase() === key && p.pin.url) urls.push(p.pin.url);
    }
  }
  return urls;
}

function CreatorRow({ entry, pins, creators, onCreateCreator, upsertDecision }: {
  entry: MissingCreator;
  pins: ReadonlyArray<PinPlan>;
  creators: CatalogueRows['creators'];
  onCreateCreator: (input: CreatorInput) => Promise<CreatorRef>;
  upsertDecision: (d: Decision) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState(entry.channel);
  const [externalId, setExternalId] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapExisting = (creatorId: string) => {
    if (!creatorId) return;
    upsertDecision({ kind: 'mapChannel', channel: entry.channel, creatorId: creatorId as CreatorId });
  };

  const skipPins = () => {
    for (const u of urlsForChannel(pins, entry.channel)) {
      upsertDecision({ kind: 'skipPin', url: u, reason: 'No creator for this channel' });
    }
  };

  const submitCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await onCreateCreator({ displayName, externalId, url, platform: 'youtube' });
      upsertDecision({ kind: 'mapChannel', channel: entry.channel, creatorId: created.id });
      setCreating(false);
    } catch {
      setError('Could not create the creator. Check the fields and try again.');
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
              <Text fontWeight='semibold'>{entry.channel}</Text>
              <Text fontSize='sm' color='fg.muted'>
                {entry.pinCount} pins
                {entry.closest && ` · closest: ${entry.closest.displayName}`}
              </Text>
            </Stack>
          </HStack>

          <HStack gap={3} flexWrap='wrap' align='end'>
            <Field.Root width='auto'>
              <Field.Label fontSize='xs'>Map to existing creator</Field.Label>
              <NativeSelect.Root size='sm' width='240px'>
                <NativeSelect.Field
                  defaultValue=''
                  onChange={(e) => mapExisting(e.currentTarget.value)}
                >
                  <option value=''>Select a creator…</option>
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Button size='sm' variant='subtle' onClick={() => setCreating((v) => !v)}>
              {creating ? 'Cancel' : 'Create creator'}
            </Button>
            <Button size='sm' variant='ghost' colorPalette='gray' onClick={skipPins}>
              Skip these pins
            </Button>
          </HStack>

          {creating && (
            <Stack gap={3} borderTopWidth='1px' pt={3}>
              <Field.Root required>
                <Field.Label fontSize='xs'>Display name</Field.Label>
                <Input size='sm' value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field.Root>
              <Field.Root required>
                <Field.Label fontSize='xs'>Channel handle (external id)</Field.Label>
                <Input
                  size='sm'
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder='@channelhandle'
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label fontSize='xs'>Channel URL</Field.Label>
                <Input
                  size='sm'
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder='https://youtube.com/@channelhandle'
                />
              </Field.Root>
              {error && <Text fontSize='sm' color='fg.error'>{error}</Text>}
              <Button
                size='sm'
                alignSelf='start'
                loading={busy}
                disabled={displayName.trim() === '' || externalId.trim() === '' || url.trim() === ''}
                onClick={() => void submitCreate()}
              >
                Create and map
              </Button>
            </Stack>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

export function CreatorsTab({ missingCreators, pins, creators, onCreateCreator, upsertDecision }: Props) {
  if (missingCreators.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>Every channel resolves to a creator</EmptyState.Title>
          <EmptyState.Description>No creators need attention.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Stack gap={3} pt={4}>
      {missingCreators.map((entry) => (
        <CreatorRow
          key={entry.channel}
          entry={entry}
          pins={pins}
          creators={creators}
          onCreateCreator={onCreateCreator}
          upsertDecision={upsertDecision}
        />
      ))}
    </Stack>
  );
}
