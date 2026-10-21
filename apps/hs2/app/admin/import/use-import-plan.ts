'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildCatalogue,
  decisionRef,
  foldDecisions,
  resolveLayer,
  type CatalogueRows,
  type Decision,
  type DecisionRef,
  type ImportId,
  type ImportPlan,
  type ImportSessionMeta,
  type ParsedLayer,
  type SpanLookup,
} from '@/lib/import';

import { spanLookup as spanLookupAction } from './actions';

const STORAGE_KEY = 'hs2-import-draft';

type PersistedDraft = { fileName: string; layer: ParsedLayer; decisions: Decision[] };

export type Draft = {
  fileName: string;
  layer: ParsedLayer;
  /** Keyed by decisionRef identity so a decision upserts/removes by subject. */
  decisions: Map<string, Decision>;
};

function refKey(ref: DecisionRef): string {
  return `${ref.kind}\u0000${ref.subject}`;
}

function loadPersisted(): PersistedDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedDraft) : null;
  } catch {
    return null;
  }
}

export function useImportPlan(rows: CatalogueRows | null) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);

  // Restore a draft a refresh left behind. The catalogue is re-fetched by the
  // wizard from the restored layer's urls; only the draft itself is persisted.
  // Deferred to a microtask so the restore syncs after hydration rather than
  // forcing a synchronous render cascade.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const p = loadPersisted();
      if (!p) return;
      setDraft({
        fileName: p.fileName,
        layer: p.layer,
        decisions: new Map(p.decisions.map((d) => [refKey(decisionRef(d)), d])),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!draft) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const persisted: PersistedDraft = {
      fileName: draft.fileName,
      layer: draft.layer,
      decisions: [...draft.decisions.values()],
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [draft]);

  const catalogue = useMemo(() => (rows ? buildCatalogue(rows) : null), [rows]);

  // Re-derive the plan whenever the layer, the decisions, or the catalogue
  // change. resolveLayer is async (span lookups), so a cancel flag drops a
  // stale result if inputs change mid-flight. The session meta is display-only
  // in the plan, so a throwaway one per derive is fine.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!draft || !catalogue) {
        if (!cancelled) setPlan(null);
        return;
      }
      if (!cancelled) setIsDeriving(true);
      const decisions = foldDecisions([...draft.decisions.values()]);
      const lookup: SpanLookup = (from, to) => spanLookupAction(from, to);
      const session: ImportSessionMeta = {
        id: crypto.randomUUID() as ImportId,
        name: draft.fileName,
        fileName: draft.fileName,
        createdAt: new Date().toISOString(),
        lastApply: null,
      };
      try {
        const p = await resolveLayer(draft.layer, decisions, catalogue, lookup, session);
        if (!cancelled) setPlan(p);
      } catch {
        if (!cancelled) setPlan(null);
      } finally {
        if (!cancelled) setIsDeriving(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [draft, catalogue]);

  const startDraft = useCallback((fileName: string, layer: ParsedLayer) => {
    setDraft({ fileName, layer, decisions: new Map() });
  }, []);

  const clearDraft = useCallback(() => setDraft(null), []);

  const upsertDecision = useCallback((d: Decision) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const decisions = new Map(cur.decisions);
      decisions.set(refKey(decisionRef(d)), d);
      return { ...cur, decisions };
    });
  }, []);

  const removeDecision = useCallback((ref: DecisionRef) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const decisions = new Map(cur.decisions);
      decisions.delete(refKey(ref));
      return { ...cur, decisions };
    });
  }, []);

  return { draft, plan, isDeriving, startDraft, clearDraft, upsertDecision, removeDecision };
}
