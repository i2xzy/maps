'use client';

import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import {
  Alert,
  AspectRatio,
  Box,
  Button,
  Card,
  Field,
  Grid,
  Heading,
  HStack,
  Input,
  Link,
  Stack,
  Text,
} from '@chakra-ui/react';

import type { CatalogueRows } from '@/lib/import';

import type { CommitPinInput, CommitPinResult, FeatureGeometry } from './actions';
import { FeatureChecklist } from './FeatureChecklist';
import { ReviewMap } from './ReviewMap';
import { type ReviewItem } from './phase';

type Edit = { title: string; featureIds: string[] };

type LoadFeatureGeometries = (ids: string[]) => Promise<FeatureGeometry[]>;

type Props = {
  items: ReviewItem[];
  features: CatalogueRows['features'];
  alreadyImported: number;
  commitPin: (input: CommitPinInput) => Promise<CommitPinResult>;
  loadFeatureGeometries: LoadFeatureGeometries;
  finishImport: () => Promise<void>;
  onRestart: () => void;
};

type Counts = { imported: number; skipped: number; linksAdded: number };

export function ReviewStep({
  items,
  features,
  alreadyImported,
  commitPin,
  loadFeatureGeometries,
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
      loadFeatureGeometries={loadFeatureGeometries}
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
  loadFeatureGeometries,
  rowNumber,
  total,
  onConfirm,
  onSkip,
}: {
  item: ReviewItem;
  features: CatalogueRows['features'];
  loadFeatureGeometries: LoadFeatureGeometries;
  rowNumber: number;
  total: number;
  onConfirm: (edit: Edit) => Promise<void>;
  onSkip: () => void;
}) {
  const [title, setTitle] = useState(item.initialTitle);
  const [featureIds, setFeatureIds] = useState<string[]>(() =>
    item.initialFeatures.map((f) => f.id),
  );
  const [featureGeos, setFeatureGeos] = useState<FeatureGeometry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the selected features' geometry for the map whenever the selection
  // changes. Small sets (a pin's features), so no debounce; a stale-drop flag
  // keeps an out-of-order response from overwriting a newer one.
  useEffect(() => {
    if (featureIds.length === 0) return;
    let cancelled = false;
    void loadFeatureGeometries(featureIds)
      .then((g) => {
        if (!cancelled) setFeatureGeos(g);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [featureIds, loadFeatureGeometries]);

  // Only draw features still selected: hides a just-removed feature immediately
  // (before any refetch) and ignores a stale fetch that outlived its selection.
  const shownGeos = featureGeos.filter((g) => featureIds.includes(g.id));

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

          {/* Top region, two columns of equal height: the video + map on the
              left, the feature checklist on the right (so the list is visible
              beside the media, not below it). Stacks on narrow screens. The
              details, title and actions sit below, outside the list's scroll. */}
          <Grid
            templateColumns={{ base: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}
            gap={6}
            alignItems='stretch'
          >
            <Stack gap={4}>
              {item.media.youtubeId && (
                // Same react-player v3 setup as the /media/[id] page: the native
                // controls come from the `controls` prop, and the pin url's ?t=
                // timestamp is honoured when passed straight through as `src`.
                <AspectRatio ratio={16 / 9} w='full'>
                  <ReactPlayer src={item.media.url} controls width='100%' height='100%' />
                </AspectRatio>
              )}

              <ReviewMap
                geometry={item.media.geometry}
                shotType={item.media.shotType}
                features={shownGeos}
              />
            </Stack>

            <Box h='full' minH='0'>
              <FeatureChecklist features={features} value={featureIds} onChange={setFeatureIds} />
            </Box>
          </Grid>

          <Stack gap={1}>
            <DetailRow label='Creator'>{item.creatorName}</DetailRow>
            <DetailRow label='Shot type'>{item.media.shotType}</DetailRow>
            <DetailRow label='Published'>{item.media.publishedAt ?? '—'}</DetailRow>
            <DetailRow label='Recorded'>{item.media.recordedDate ?? '—'}</DetailRow>
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
