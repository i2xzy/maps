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
} from '@/lib/import';

type CreatorInput = {
  displayName: string;
  url: string;
  platform?: string;
  externalId: string;
  profileImageUrl?: string;
};

type Props = {
  missingCreators: ReadonlyArray<MissingCreator>;
  creators: CatalogueRows['creators'];
  onCreateCreator: (input: CreatorInput) => Promise<CreatorRef>;
  upsertDecision: (d: Decision) => void;
};

// Pull the channel handle out of a URL: youtube.com/@handle, /c/Name, /user/Name.
// Returns '' when there's none (e.g. a /channel/UC… id URL), so the admin types it.
function deriveHandle(url: string): string {
  const at = url.match(/@([A-Za-z0-9._-]+)/);
  if (at) return at[1] ?? '';
  const path = url.match(/\/(?:c|user)\/([^/?#]+)/);
  if (path) return path[1] ?? '';
  return '';
}

function CreatorRow({ entry, creators, onCreateCreator, upsertDecision }: {
  entry: MissingCreator;
  creators: CatalogueRows['creators'];
  onCreateCreator: (input: CreatorInput) => Promise<CreatorRef>;
  upsertDecision: (d: Decision) => void;
}) {
  const [creating, setCreating] = useState(false);
  // Preselect the closest existing creator (common case: a renamed creator whose
  // old name is still in the export). The admin confirms with an explicit button.
  const [selectedId, setSelectedId] = useState<string>(entry.closest?.id ?? '');
  const [displayName, setDisplayName] = useState(entry.channel);
  const [externalId, setExternalId] = useState('');
  const [url, setUrl] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapExisting = (creatorId: string) => {
    if (!creatorId) return;
    upsertDecision({ kind: 'mapChannel', channel: entry.channel, creatorId: creatorId as CreatorId });
  };

  const submitCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await onCreateCreator({
        displayName,
        externalId: externalId.replace(/^@+/, '').trim(),
        url,
        platform: 'youtube',
        profileImageUrl: profileImageUrl.trim() || undefined,
      });
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
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.currentTarget.value)}
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
            <Button size='sm' onClick={() => mapExisting(selectedId)} disabled={selectedId === ''}>
              Map to this creator
            </Button>
            <Button size='sm' variant='subtle' onClick={() => setCreating((v) => !v)}>
              {creating ? 'Cancel' : 'Create creator'}
            </Button>
          </HStack>

          {creating && (
            <Stack gap={3} borderTopWidth='1px' pt={3}>
              <Field.Root required>
                <Field.Label fontSize='xs'>Display name</Field.Label>
                <Input size='sm' value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field.Root>
              <Field.Root required>
                <Field.Label fontSize='xs'>Channel URL</Field.Label>
                <Input
                  size='sm'
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (!handleTouched) setExternalId(deriveHandle(e.target.value));
                  }}
                  placeholder='https://youtube.com/@channelhandle'
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label fontSize='xs'>Channel handle</Field.Label>
                <Input
                  size='sm'
                  value={externalId}
                  onChange={(e) => {
                    setExternalId(e.target.value);
                    setHandleTouched(true);
                  }}
                  placeholder='channelhandle'
                />
                <Field.HelperText fontSize='xs'>
                  Pulled from the URL, shown on the site as @
                  {externalId.replace(/^@+/, '') || 'handle'}. Edit if the URL has no handle.
                </Field.HelperText>
              </Field.Root>
              <Field.Root>
                <Field.Label fontSize='xs'>Profile image URL (optional)</Field.Label>
                <Input
                  size='sm'
                  value={profileImageUrl}
                  onChange={(e) => setProfileImageUrl(e.target.value)}
                  placeholder='https://…/avatar.jpg'
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

export function CreatorsTab({ missingCreators, creators, onCreateCreator, upsertDecision }: Props) {
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

  // Sorted once here so every row's dropdown is alphabetical by display name.
  const sorted = [...creators].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Stack gap={3} pt={4}>
      {missingCreators.map((entry) => (
        <CreatorRow
          key={entry.channel}
          entry={entry}
          creators={sorted}
          onCreateCreator={onCreateCreator}
          upsertDecision={upsertDecision}
        />
      ))}
    </Stack>
  );
}
