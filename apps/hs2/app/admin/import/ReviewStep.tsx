'use client';

import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import {
  Alert,
  AspectRatio,
  Button,
  Card,
  Field,
  Heading,
  HStack,
  Input,
  Link,
  Stack,
  Text,
} from '@chakra-ui/react';

import type { CatalogueRows } from '@/lib/import';

import type { CommitPinInput, CommitPinResult } from './actions';
import { FeatureCombobox } from './FeatureCombobox';
import { geometryKind, type ReviewItem } from './phase';

type Edit = { title: string; featureIds: string[] };

type Props = {
  items: ReviewItem[];
  features: CatalogueRows['features'];
  alreadyImported: number;
  commitPin: (input: CommitPinInput) => Promise<CommitPinResult>;
  finishImport: () => Promise<void>;
  onRestart: () => void;
};

type Counts = { imported: number; skipped: number; linksAdded: number };

export function ReviewStep({
  items,
  features,
  alreadyImported,
  commitPin,
  finishImport,
  onRestart,
}: Props) {
  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState<Counts>({ imported: 0, skipped: 0, linksAdded: 0 });
  const done = index >= items.length;
  const finishedRef = useRef(false);

  useEffect(() => {
    if (done && !finishedRef.current) {
      finishedRef.current = true;
      void finishImport();
    }
  }, [done, finishImport]);

  const handleConfirm = async (item: ReviewItem, edit: Edit) => {
    const res = await commitPin({
      url: item.media.url,
      title: edit.title,
      description: item.media.description,
      youtubeId: item.media.youtubeId,
      shotType: item.media.shotType,
      type: item.media.type,
      publishedAt: item.media.publishedAt,
      recordedDate: item.media.recordedDate,
      creatorId: item.media.creatorId,
      geometry: item.media.geometry,
      featureIds: edit.featureIds,
    });
    setCounts((c) => ({
      imported: c.imported + 1,
      skipped: c.skipped,
      linksAdded: c.linksAdded + res.linksAdded,
    }));
    setIndex((i) => i + 1);
  };

  const handleSkip = () => {
    setCounts((c) => ({ ...c, skipped: c.skipped + 1 }));
    setIndex((i) => i + 1);
  };

  if (done) {
    return (
      <DoneSummary
        total={items.length}
        counts={counts}
        alreadyImported={alreadyImported}
        onRestart={onRestart}
      />
    );
  }

  const item = items[index];
  if (!item) return null;
  return (
    <PinReviewCard
      key={item.ordinal}
      item={item}
      features={features}
      rowNumber={index + 1}
      total={items.length}
      onConfirm={(edit) => handleConfirm(item, edit)}
      onSkip={handleSkip}
    />
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <HStack gap={3} align='baseline'>
      <Text fontSize='sm' color='fg.muted' minW='7rem'>
        {label}
      </Text>
      <Text fontSize='sm'>{children}</Text>
    </HStack>
  );
}

function PinReviewCard({
  item,
  features,
  rowNumber,
  total,
  onConfirm,
  onSkip,
}: {
  item: ReviewItem;
  features: CatalogueRows['features'];
  rowNumber: number;
  total: number;
  onConfirm: (edit: Edit) => Promise<void>;
  onSkip: () => void;
}) {
  const [title, setTitle] = useState(item.initialTitle);
  const [featureIds, setFeatureIds] = useState<string[]>(() =>
    item.initialFeatures.map((f) => f.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ title, featureIds });
    } catch {
      setError('Could not save this pin. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <Card.Root variant='elevated'>
      <Card.Body>
        <Stack gap={4}>
          <Heading size='md'>
            Row {rowNumber} of {total}
          </Heading>

          {item.media.youtubeId && (
            <AspectRatio ratio={16 / 9} w='full' maxW='2xl'>
              <ReactPlayer
                ref={playerRef}
                src={`https://www.youtube.com/embed/${item.media.youtubeId}`}
                controls
                width='100%'
                height='100%'
              />
            </AspectRatio>
          )}

          <Stack gap={1}>
            <DetailRow label='Creator'>{item.creatorName}</DetailRow>
            <DetailRow label='Shot type'>{item.media.shotType}</DetailRow>
            <DetailRow label='Published'>{item.media.publishedAt ?? '—'}</DetailRow>
            <DetailRow label='Recorded'>{item.media.recordedDate ?? '—'}</DetailRow>
            <DetailRow label='Geometry'>{geometryKind(item.media.geometry)}</DetailRow>
            <DetailRow label='URL'>
              <Link href={item.media.url} target='_blank' rel='noreferrer'>
                {item.media.url}
              </Link>
            </DetailRow>
          </Stack>

          <Field.Root>
            <Field.Label fontSize='sm'>Title</Field.Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field.Root>

          <FeatureCombobox features={features} value={featureIds} onChange={setFeatureIds} />

          {error && (
            <Alert.Root status='error'>
              <Alert.Indicator />
              <Alert.Title>{error}</Alert.Title>
            </Alert.Root>
          )}

          <HStack gap={3} pt={1}>
            <Button loading={busy} onClick={() => void confirm()}>
              Confirm
            </Button>
            <Button variant='ghost' colorPalette='gray' disabled={busy} onClick={onSkip}>
              Skip
            </Button>
          </HStack>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

function DoneSummary({
  total,
  counts,
  alreadyImported,
  onRestart,
}: {
  total: number;
  counts: Counts;
  alreadyImported: number;
  onRestart: () => void;
}) {
  return (
    <Card.Root variant='elevated' maxW='xl'>
      <Card.Body>
        <Stack gap={4} align='start'>
          <Heading size='md'>Import complete</Heading>
          <Text color='fg.muted' fontSize='sm'>
            {total === 0 ? 'No new pins to import.' : `Reviewed ${total} new pins.`}
          </Text>
          <Stack gap={1}>
            <DetailRow label='Imported'>{counts.imported}</DetailRow>
            <DetailRow label='Links added'>{counts.linksAdded}</DetailRow>
            <DetailRow label='Skipped'>{counts.skipped}</DetailRow>
            <DetailRow label='Already in database'>{alreadyImported}</DetailRow>
          </Stack>
          <Button onClick={onRestart}>Import another layer</Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
