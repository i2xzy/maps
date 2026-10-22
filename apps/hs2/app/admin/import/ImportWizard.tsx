'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Heading,
  HStack,
  Icon,
  Spinner,
  Stack,
  Steps,
  Text,
} from '@chakra-ui/react';
import { LuUpload } from 'react-icons/lu';

import {
  parseLayer,
  type CatalogueRows,
  type CreatorRef,
  type ParsedLayer,
  type Url,
} from '@/lib/import';

import {
  commitPin,
  createCreator as createCreatorAction,
  finishImport,
  loadCatalogue,
  loadFeatureGeometries,
} from './actions';
import { useImportPlan } from './use-import-plan';
import { IssuesTab } from './tabs/IssuesTab';
import { CreatorsTab } from './tabs/CreatorsTab';
import { ReviewStep } from './ReviewStep';
import {
  alreadyImportedCount,
  derivePhase,
  phaseIndex,
  PHASE_LABELS,
  PHASE_ORDER,
  reviewItems,
  type Phase,
} from './phase';

type CreatorInput = Parameters<typeof createCreatorAction>[0];

function layerUrls(layer: ParsedLayer): string[] {
  return layer.pins.map((p) => p.url).filter((u): u is Url => u !== null);
}

export function ImportWizard() {
  const [rows, setRows] = useState<CatalogueRows | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { draft, plan, isDeriving, startDraft, clearDraft, upsertDecision } = useImportPlan(rows);

  const layer = draft?.layer;
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!layer) {
        if (!cancelled) setRows(null);
        return;
      }
      if (!cancelled) setCatalogueError(null);
      try {
        const r = await loadCatalogue(layerUrls(layer));
        if (!cancelled) setRows(r);
      } catch {
        if (!cancelled) setCatalogueError('Could not load the catalogue. Try reloading the page.');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [layer]);

  const refetchCatalogue = useCallback(async () => {
    if (!layer) return;
    setRows(await loadCatalogue(layerUrls(layer)));
  }, [layer]);

  const handleCreateCreator = useCallback(
    async (input: CreatorInput): Promise<CreatorRef> => {
      const created = await createCreatorAction(input);
      await refetchCatalogue();
      return created;
    },
    [refetchCatalogue],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      try {
        const parsed = parseLayer(await file.text());
        if (parsed.pins.length === 0) {
          setUploadError('That file has no pins.');
          return;
        }
        startDraft(file.name, parsed);
      } catch {
        setUploadError('Could not parse that file. Is it a Google My Maps KML export?');
      }
    },
    [startDraft],
  );

  const openPicker = () => fileInputRef.current?.click();

  const items = useMemo(() => (plan ? reviewItems(plan) : []), [plan]);
  const phase: Phase = !draft ? 'upload' : plan ? derivePhase(plan) : 'issues';

  return (
    <Stack gap={6}>
      <input
        ref={fileInputRef}
        type='file'
        accept='.kml,application/vnd.google-earth.kml+xml'
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      <HStack justify='space-between' align='start'>
        <Stack gap={1}>
          <Heading size='lg'>Import a layer</Heading>
          {draft && (
            <Text fontSize='sm' color='fg.muted'>
              {draft.fileName} · {draft.layer.pins.length} pins
            </Text>
          )}
        </Stack>
        {draft && (
          <Button variant='outline' colorPalette='gray' size='sm' onClick={clearDraft}>
            Start over
          </Button>
        )}
      </HStack>

      <Steps.Root step={phaseIndex(phase)} count={PHASE_ORDER.length} size='sm'>
        <Steps.List>
          {PHASE_ORDER.map((p, i) => (
            <Steps.Item key={p} index={i} title={PHASE_LABELS[p]}>
              <Steps.Indicator />
              <Steps.Title>{PHASE_LABELS[p]}</Steps.Title>
              <Steps.Separator />
            </Steps.Item>
          ))}
        </Steps.List>
      </Steps.Root>

      {catalogueError && (
        <Alert.Root status='error'>
          <Alert.Indicator />
          <Alert.Title>{catalogueError}</Alert.Title>
        </Alert.Root>
      )}

      {phase === 'upload' ? (
        <Card.Root variant='elevated' maxW='xl'>
          <Card.Body>
            <Stack gap={5} align='start'>
              <Text color='fg.muted' fontSize='sm'>
                Upload a Google My Maps KML export. It is parsed in your browser, then you confirm
                each pin one at a time.
              </Text>
              <Button onClick={openPicker}>
                <Icon>
                  <LuUpload />
                </Icon>
                Choose KML file
              </Button>
              {uploadError && (
                <Alert.Root status='error'>
                  <Alert.Indicator />
                  <Alert.Title>{uploadError}</Alert.Title>
                </Alert.Root>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : !plan || !rows ? (
        <HStack color='fg.muted'>
          <Spinner size='sm' />
          <Text>Deriving the plan…</Text>
        </HStack>
      ) : phase === 'issues' ? (
        <Stack gap={4} align='start'>
          <Text fontSize='sm' color='fg.muted'>
            Fix these in Google My Maps, re-export, and upload the corrected file. The step clears
            itself once a file parses with no issues.
          </Text>
          <Button onClick={openPicker}>
            <Icon>
              <LuUpload />
            </Icon>
            Upload corrected file
          </Button>
          {uploadError && (
            <Alert.Root status='error'>
              <Alert.Indicator />
              <Alert.Title>{uploadError}</Alert.Title>
            </Alert.Root>
          )}
          {isDeriving && <Spinner size='sm' />}
          <IssuesTab pins={plan.pins} />
        </Stack>
      ) : phase === 'creators' ? (
        <Stack gap={4} align='start'>
          <Text fontSize='sm' color='fg.muted'>
            Create or map each channel to a creator. The step clears itself once every channel
            resolves.
          </Text>
          {isDeriving && <Spinner size='sm' />}
          <CreatorsTab
            missingCreators={plan.worklists.missingCreators}
            creators={rows.creators}
            onCreateCreator={handleCreateCreator}
            upsertDecision={upsertDecision}
          />
        </Stack>
      ) : (
        <ReviewStep
          items={items}
          features={rows.features}
          alreadyImported={alreadyImportedCount(plan)}
          commitPin={commitPin}
          loadFeatureGeometries={loadFeatureGeometries}
          finishImport={finishImport}
          onRestart={clearDraft}
        />
      )}
    </Stack>
  );
}
