'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Heading,
  HStack,
  Icon,
  Spinner,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react';
import { LuUpload } from 'react-icons/lu';

import {
  parseLayer,
  type CatalogueRows,
  type CreatorRef,
  type ImportDraft,
  type ParsedLayer,
  type Url,
} from '@/lib/import';

import {
  addAlias as addAliasAction,
  commitImport as commitImportAction,
  createCreator as createCreatorAction,
  loadCatalogue,
} from './actions';
import { useImportPlan } from './use-import-plan';
import { SummaryTab } from './tabs/SummaryTab';
import { CreatorsTab } from './tabs/CreatorsTab';
import { TitlesTab } from './tabs/TitlesTab';
import { RangesTab } from './tabs/RangesTab';
import { PinsTab } from './tabs/PinsTab';
import { ApplyTab } from './tabs/ApplyTab';

type ApplyResult = Awaited<ReturnType<typeof commitImportAction>>;
type CreatorInput = Parameters<typeof createCreatorAction>[0];

function layerUrls(layer: ParsedLayer): string[] {
  return layer.pins.map((p) => p.url).filter((u): u is Url => u !== null);
}

export function ImportWizard() {
  const [rows, setRows] = useState<CatalogueRows | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { draft, plan, isDeriving, startDraft, clearDraft, upsertDecision, removeDecision } =
    useImportPlan(rows);

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

  const handleAddAlias = useCallback(
    async (alias: string, featureNames: string[]) => {
      await addAliasAction(alias, featureNames);
      await refetchCatalogue();
    },
    [refetchCatalogue],
  );

  const handleApply = useCallback(async () => {
    if (!draft) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      const importDraft: ImportDraft = {
        layer: draft.layer,
        decisions: [...draft.decisions.values()],
      };
      setApplyResult(await commitImportAction(importDraft));
    } catch {
      setApplyError('The import failed. You can fix the issue and apply again; writes are idempotent.');
    } finally {
      setIsApplying(false);
    }
  }, [draft]);

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setApplyResult(null);
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

  if (!draft) {
    return (
      <Card.Root variant='elevated' maxW='xl'>
        <Card.Body>
          <Stack gap={5} align='start'>
            <Stack gap={1}>
              <Heading size='lg'>Import a layer</Heading>
              <Text color='fg.muted' fontSize='sm'>
                Upload a Google My Maps KML export. It is parsed in your browser; nothing is
                written until you apply.
              </Text>
            </Stack>
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
            <Button onClick={() => fileInputRef.current?.click()}>
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
    );
  }

  const missing = plan?.worklists.missingCreators.length ?? 0;
  const unmatched = plan?.worklists.unmatchedCandidates.length ?? 0;
  const rangeCount = plan?.worklists.ranges.length ?? 0;

  return (
    <Stack gap={5}>
      <HStack justify='space-between' align='center'>
        <Stack gap={0}>
          <Heading size='lg'>Import a layer</Heading>
          <Text fontSize='sm' color='fg.muted'>
            {draft.fileName} · {draft.layer.pins.length} pins
          </Text>
        </Stack>
        <HStack gap={3}>
          {isDeriving && <Spinner size='sm' />}
          <Button variant='outline' size='sm' onClick={clearDraft}>
            Start over
          </Button>
        </HStack>
      </HStack>

      {catalogueError && (
        <Alert.Root status='error'>
          <Alert.Indicator />
          <Alert.Title>{catalogueError}</Alert.Title>
        </Alert.Root>
      )}

      {!plan || !rows ? (
        <HStack color='fg.muted'>
          <Spinner size='sm' />
          <Text>Deriving the plan…</Text>
        </HStack>
      ) : (
        <Tabs.Root defaultValue='summary' variant='enclosed'>
          <Tabs.List flexWrap='wrap'>
            <Tabs.Trigger value='summary'>Summary</Tabs.Trigger>
            <Tabs.Trigger value='creators'>
              Creators
              {missing > 0 && (
                <Badge ml={2} colorPalette='orange'>
                  {missing}
                </Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value='titles'>
              Titles
              {unmatched > 0 && (
                <Badge ml={2} colorPalette='orange'>
                  {unmatched}
                </Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value='ranges'>
              Ranges
              {rangeCount > 0 && (
                <Badge ml={2} colorPalette='gray'>
                  {rangeCount}
                </Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value='pins'>Pins</Tabs.Trigger>
            <Tabs.Trigger value='apply'>Apply</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value='summary'>
            <SummaryTab plan={plan} isDeriving={isDeriving} />
          </Tabs.Content>
          <Tabs.Content value='creators'>
            <CreatorsTab
              missingCreators={plan.worklists.missingCreators}
              pins={plan.pins}
              creators={rows.creators}
              onCreateCreator={handleCreateCreator}
              upsertDecision={upsertDecision}
            />
          </Tabs.Content>
          <Tabs.Content value='titles'>
            <TitlesTab
              candidates={plan.worklists.unmatchedCandidates}
              features={rows.features}
              onAddAlias={handleAddAlias}
              upsertDecision={upsertDecision}
            />
          </Tabs.Content>
          <Tabs.Content value='ranges'>
            <RangesTab
              ranges={plan.worklists.ranges}
              upsertDecision={upsertDecision}
              removeDecision={removeDecision}
            />
          </Tabs.Content>
          <Tabs.Content value='pins'>
            <PinsTab
              pins={plan.pins}
              upsertDecision={upsertDecision}
              removeDecision={removeDecision}
            />
          </Tabs.Content>
          <Tabs.Content value='apply'>
            <ApplyTab
              summary={plan.summary}
              onApply={handleApply}
              isApplying={isApplying}
              result={applyResult}
              error={applyError}
            />
          </Tabs.Content>
        </Tabs.Root>
      )}
    </Stack>
  );
}
