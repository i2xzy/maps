import { describe, expect, it } from 'vitest';

import { foldDecisions, type Decision } from './decisions';
import { resolveLayer } from './resolve';
import { catalogueFixture, creator, feature, sessionMeta } from './test-support';
import type { Decisions, ParsedLayer, Pin, ParseWarning, ShotType, SpanLookup, Url } from './types';
import { emptyDecisions } from './types';

const wendover = feature('f1', 'Wendover Dean Viaduct');
const curzon = feature('f2', 'Curzon Street Station');
const aston = feature('f3', 'Aston Church Road Overbridge', 10);
const leather = feature('f4', 'Leather Lane Overbridge', 30);
const mid = feature('f5', 'Marston Road Overbridge', 20);

const djs = creator('c1', 'djsviews');

const catalogue = catalogueFixture({
  features: [wendover, curzon, aston, leather, mid],
  aliases: [['Water Orton Viaducts', [wendover, curzon]]],
  creators: [djs],
  existing: [['https://youtu.be/existing0001', { id: 'm1', featureIds: ['f2'] }]],
});

const noSpans: SpanLookup = async () => [];

function spanLookup(table: Record<string, string[]>): SpanLookup {
  return async (from, to) => table[`${from}->${to}`] ?? [];
}

let seq = 0;
function pin(o: Partial<Pin>): Pin {
  return {
    ordinal: o.ordinal ?? seq++,
    url: o.url ?? null,
    title: o.title ?? 'x',
    channel: o.channel ?? '',
    description: o.description ?? null,
    youtubeId: o.youtubeId ?? null,
    shotType: o.shotType ?? null,
    rawType: o.rawType ?? '',
    publishedAt: o.publishedAt ?? null,
    publishedRaw: o.publishedRaw ?? '',
    recordedDate: o.recordedDate ?? null,
    recordedRaw: o.recordedRaw ?? '',
    geometry: o.geometry ?? null,
  };
}

function layer(pins: Pin[], warnings: ParseWarning[] = []): ParsedLayer {
  return { pins, warnings };
}

const asUrl = (s: string): Url => s as Url;

function resolve(l: ParsedLayer, decisions: Decisions = emptyDecisions, lookup: SpanLookup = noSpans) {
  return resolveLayer(l, decisions, catalogue, lookup, sessionMeta);
}

describe('resolveLayer: dispositions', () => {
  it('inserts a clean new pin with its creator, shot type, and feature link', async () => {
    const plan = await resolve(
      layer([
        pin({
          ordinal: 0,
          url: asUrl('https://youtu.be/newpin00001'),
          title: '2025-01-02 Wendover Dean Viaduct',
          channel: 'djsviews',
          shotType: 'drone',
        }),
      ]),
    );
    const p = plan.pins[0];
    expect(p?.kind).toBe('insert');
    if (p?.kind === 'insert') {
      expect(p.creator.id).toBe('c1');
      expect(p.draft.shotType).toBe('drone');
      expect(p.draft.type).toBe('video');
      expect(p.links).toEqual([wendover]);
    }
    expect(plan.summary.insert).toBe(1);
    expect(plan.summary.linksPlanned).toBe(1);
  });

  it('blocks a URL-in-channel pin as a source error, not a missing creator', async () => {
    const plan = await resolve(
      layer(
        [pin({ ordinal: 0, url: asUrl('https://youtu.be/badchannel1'), channel: 'https://youtu.be/x', shotType: 'drone' })],
        [{ pin: 0, kind: 'channel-is-url', value: 'https://youtu.be/x' }],
      ),
    );
    const p = plan.pins[0];
    expect(p?.kind).toBe('blocked');
    if (p?.kind === 'blocked' && p.reason.kind === 'bad-channel') expect(p.reason.why).toBe('url');
    expect(plan.summary.blocked['bad-channel']).toBe(1);
    expect(plan.worklists.missingCreators).toHaveLength(0);
    expect(plan.worklists.badChannels[0]).toMatchObject({ why: 'url', pinCount: 1 });
  });

  it('blocks a date-in-channel pin (swapped fields) as a source error', async () => {
    const plan = await resolve(
      layer(
        [pin({ ordinal: 0, url: asUrl('https://youtu.be/badchannel2'), channel: '16 Oct 2026', shotType: 'drone' })],
        [{ pin: 0, kind: 'misplaced-date', field: 'channel', value: '16 Oct 2026' }],
      ),
    );
    const p = plan.pins[0];
    expect(p?.kind).toBe('blocked');
    if (p?.kind === 'blocked' && p.reason.kind === 'bad-channel') expect(p.reason.why).toBe('date');
    expect(plan.worklists.missingCreators).toHaveLength(0);
    expect(plan.worklists.badChannels[0]).toMatchObject({ why: 'date', pinCount: 1 });
  });

  it('locates an unmatched candidate by title when the pin has no video id', async () => {
    const plan = await resolve(
      layer([
        pin({ ordinal: 0, url: null, title: '2026-09-22 Curzon Street Statio', channel: 'djsviews', shotType: 'drone' }),
      ]),
    );
    const uc = plan.worklists.unmatchedCandidates.find((c) => c.text === 'Curzon Street Statio');
    expect(uc?.locators).toEqual([{ videoId: null, title: '2026-09-22 Curzon Street Statio' }]);
  });

  it('blocks a pin whose channel resolves to no creator and suggests the closest', async () => {
    const plan = await resolve(
      layer([pin({ url: asUrl('https://youtu.be/nocreator01'), channel: 'djsview', shotType: 'drone' })]),
    );
    expect(plan.pins[0]?.kind).toBe('blocked');
    expect(plan.summary.blocked['no-creator']).toBe(1);
    expect(plan.worklists.missingCreators[0]?.channel).toBe('djsview');
    expect(plan.worklists.missingCreators[0]?.closest?.id).toBe('c1');
  });

  it('blocks a pin with an unmapped shot type and lists it (no DB-default fallback)', async () => {
    const plan = await resolve(
      layer([pin({ url: asUrl('https://youtu.be/noshot00001'), channel: 'djsviews', rawType: 'satellite' })]),
    );
    expect(plan.pins[0]?.kind).toBe('blocked');
    expect(plan.summary.blocked['no-shot-type']).toBe(1);
    expect(plan.worklists.unmappedShotTypes[0]).toEqual({ raw: 'satellite', pinCount: 1 });
  });

  it('blocks a pin whose Link was blank or non-URL', async () => {
    const plan = await resolve(layer([pin({ url: null, channel: 'djsviews', shotType: 'drone' })]));
    expect(plan.pins[0]?.kind).toBe('blocked');
    expect(plan.summary.blocked['no-url']).toBe(1);
  });

  it('relinks an existing url, adding only missing links and never overwriting', async () => {
    const plan = await resolve(
      layer([
        pin({
          url: asUrl('https://youtu.be/existing0001'),
          title: '2025-01-02 Wendover Dean Viaduct | Curzon Street Station',
          channel: 'djsviews',
          shotType: 'drone',
        }),
      ]),
    );
    const p = plan.pins[0];
    expect(p?.kind).toBe('relink');
    if (p?.kind === 'relink') {
      expect(p.mediaId).toBe('m1');
      expect(p.links.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
      expect(p.newLinks).toEqual([wendover]); // f2 already linked
    }
    expect(plan.summary.relink).toBe(1);
    expect(plan.summary.linksPlanned).toBe(1);
  });

  it('merges within-layer duplicate urls into the first pin with the union of links', async () => {
    const url = asUrl('https://youtu.be/dup00000001');
    const plan = await resolve(
      layer([
        pin({ ordinal: 0, url, title: '2025-01-02 Wendover Dean Viaduct', channel: 'djsviews', shotType: 'drone' }),
        pin({ ordinal: 1, url, title: '2025-01-02 Curzon Street Station', channel: 'djsviews', shotType: 'drone' }),
      ]),
    );
    const first = plan.pins[0];
    const second = plan.pins[1];
    expect(first?.kind).toBe('insert');
    if (first?.kind === 'insert') {
      expect(first.links.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    }
    expect(second?.kind).toBe('skipped');
    if (second?.kind === 'skipped') {
      expect(second.reason).toEqual({ kind: 'duplicate-url', firstOrdinal: 0 });
    }
    expect(plan.summary.duplicateUrls).toBe(1);
  });
});

describe('resolveLayer: decisions', () => {
  it('skips a pin the admin decided to skip, over any other outcome', async () => {
    const url = asUrl('https://youtu.be/skipme00001');
    const decisions = foldDecisions([{ kind: 'skipPin', url, reason: 'not HS2' } as Decision]);
    const plan = await resolve(
      layer([pin({ url, title: '2025-01-02 Wendover Dean Viaduct', channel: 'djsviews', shotType: 'drone' })]),
      decisions,
    );
    expect(plan.pins[0]?.kind).toBe('skipped');
    expect(plan.summary.skipped).toBe(1);
  });

  it('applies a candidate fix: rewrites the title and links the corrected feature via fix', async () => {
    const decisions = foldDecisions([
      { kind: 'fixCandidate', from: 'Wendover Dean Viaductt', to: 'Wendover Dean Viaduct' },
    ]);
    const plan = await resolve(
      layer([
        pin({
          url: asUrl('https://youtu.be/typo0000001'),
          title: '2025-01-02 Wendover Dean Viaductt',
          channel: 'djsviews',
          shotType: 'drone',
        }),
      ]),
      decisions,
    );
    const p = plan.pins[0];
    expect(p?.kind).toBe('insert');
    if (p?.kind === 'insert') {
      expect(p.draft.title).toBe('2025-01-02 Wendover Dean Viaduct');
      expect(p.links).toEqual([wendover]);
      expect(p.candidates[0]).toMatchObject({ kind: 'features', via: 'fix' });
    }
  });

  it('maps a misspelled channel to an existing creator', async () => {
    const decisions = foldDecisions([{ kind: 'mapChannel', channel: 'djsview', creatorId: djs.id }]);
    const plan = await resolve(
      layer([
        pin({
          url: asUrl('https://youtu.be/chan0000001'),
          title: '2025-01-02 Wendover Dean Viaduct',
          channel: 'djsview',
          shotType: 'drone',
        }),
      ]),
      decisions,
    );
    const p = plan.pins[0];
    expect(p?.kind).toBe('insert');
    if (p?.kind === 'insert') expect(p.creator.id).toBe('c1');
  });

  it('overrides a pin date without touching the others', async () => {
    const url = asUrl('https://youtu.be/dateovr0001');
    const decisions = foldDecisions([
      { kind: 'overrideDates', url, publishedAt: '2030-05-05' } as Decision,
    ]);
    const plan = await resolve(
      layer([
        pin({
          url,
          title: '2025-01-02 Wendover Dean Viaduct',
          channel: 'djsviews',
          shotType: 'drone',
          publishedAt: '2025-01-02' as Pin['publishedAt'],
        }),
      ]),
      decisions,
    );
    const p = plan.pins[0];
    if (p?.kind === 'insert') expect(p.draft.publishedAt).toBe('2030-05-05');
  });
});

describe('resolveLayer: ranges', () => {
  const rangeTitle = '2026-01-01 Aston Church Road Overbridge to Leather Lane Overbridge';
  const spanTable = {
    'Aston Church Road Overbridge->Leather Lane Overbridge': [
      'Aston Church Road Overbridge',
      'Marston Road Overbridge',
      'Leather Lane Overbridge',
    ],
  };

  it('auto-spans a drone range through chainage_span (>= 2 features)', async () => {
    const plan = await resolve(
      layer([pin({ url: asUrl('https://youtu.be/range000001'), title: rangeTitle, channel: 'djsviews', shotType: 'drone' })]),
      emptyDecisions,
      spanLookup(spanTable),
    );
    const p = plan.pins[0];
    if (p?.kind === 'insert') {
      expect(p.links.map((f) => f.id)).toEqual(['f3', 'f5', 'f4']);
    }
    const cand = p?.candidates[0];
    expect(cand?.kind).toBe('range');
    if (cand?.kind === 'range') expect(cand.span).toMatchObject({ kind: 'linked', via: 'auto' });
  });

  it('never auto-spans a ground pin: it is left manual', async () => {
    const plan = await resolve(
      layer([pin({ url: asUrl('https://youtu.be/range000002'), title: rangeTitle, channel: 'djsviews', shotType: 'ground' })]),
      emptyDecisions,
      spanLookup(spanTable),
    );
    const p = plan.pins[0];
    if (p?.kind === 'insert') expect(p.links).toEqual([]);
    const cand = p?.candidates[0];
    if (cand?.kind === 'range') {
      expect(cand.span).toEqual({ kind: 'manual', reason: 'ground-or-vehicle' });
    }
  });

  it('leaves an auto span unresolved (unlinked) when fewer than two features resolve', async () => {
    const plan = await resolve(
      layer([pin({ url: asUrl('https://youtu.be/range000003'), title: rangeTitle, channel: 'djsviews', shotType: 'drone' })]),
      emptyDecisions,
      spanLookup({ 'Aston Church Road Overbridge->Leather Lane Overbridge': ['Aston Church Road Overbridge'] }),
    );
    const cand = plan.pins[0]?.candidates[0];
    if (cand?.kind === 'range') expect(cand.span.kind).toBe('unresolved');
    if (plan.pins[0]?.kind === 'insert') expect(plan.pins[0].links).toEqual([]);
  });

  it('honours an explicit span decision', async () => {
    const decisions = foldDecisions([
      {
        kind: 'span',
        from: 'Aston Church Road Overbridge',
        to: 'Leather Lane Overbridge',
        choice: { kind: 'explicit', featureNames: ['Curzon Street Station'] },
      },
    ]);
    const plan = await resolve(
      layer([pin({ url: asUrl('https://youtu.be/range000004'), title: rangeTitle, channel: 'djsviews', shotType: 'drone' })]),
      decisions,
      spanLookup(spanTable),
    );
    const cand = plan.pins[0]?.candidates[0];
    if (cand?.kind === 'range') {
      expect(cand.span).toMatchObject({ kind: 'linked', via: 'explicit', features: [curzon] });
    }
  });

  it('surfaces the range in the worklist with its shot types', async () => {
    const plan = await resolve(
      layer([pin({ url: asUrl('https://youtu.be/range000005'), title: rangeTitle, channel: 'djsviews', shotType: 'drone' })]),
      emptyDecisions,
      spanLookup(spanTable),
    );
    const work = plan.worklists.ranges[0];
    expect(work?.from).toBe('Aston Church Road Overbridge');
    expect(work?.to).toBe('Leather Lane Overbridge');
    expect(work?.shotTypes).toEqual(['drone' as ShotType]);
  });
});

describe('resolveLayer: branch filtering', () => {
  const mainA = feature('b1', 'Delta Main A', 10, 'main');
  const mainB = feature('b2', 'Delta Main B', 20, 'main');
  const spurA = feature('b3', 'Delta Spur A', 30, 'spur');
  const spurB = feature('b4', 'Delta Spur B', 40, 'spur');
  const title = '2026-01-01 Delta Main A to Delta Spur B';
  const mixedLookup = spanLookup({
    'Delta Main A->Delta Spur B': ['Delta Main A', 'Delta Main B', 'Delta Spur A', 'Delta Spur B'],
  });

  function resolveBranch(features: ReturnType<typeof feature>[], decisions = emptyDecisions) {
    const cat = catalogueFixture({ features, creators: [djs] });
    return resolveLayer(
      layer([pin({ url: asUrl('https://youtu.be/branchpin1'), title, channel: 'djsviews', shotType: 'drone' })]),
      decisions,
      cat,
      mixedLookup,
      sessionMeta,
    );
  }

  it('reports both branches present and links the whole span when unfiltered', async () => {
    const plan = await resolveBranch([mainA, mainB, spurA, spurB]);
    const cand = plan.pins[0]?.candidates[0];
    expect(cand?.kind).toBe('range');
    if (cand?.kind === 'range' && cand.span.kind === 'linked') {
      expect(cand.span.branchesPresent).toEqual(['main', 'spur']);
      expect(cand.span.branch).toBeNull();
      expect(cand.span.branchChoiceNeeded).toBe(true);
      expect(cand.span.features.map((f) => f.id)).toEqual(['b1', 'b2', 'b3', 'b4']);
    }
    expect(plan.worklists.ranges[0]?.branchesPresent).toEqual(['main', 'spur']);
    expect(plan.worklists.ranges[0]?.branchChoiceNeeded).toBe(true);
  });

  it('filters to the endpoints’ shared branch and asks nothing, despite span bleed', async () => {
    const spurTitle = '2026-01-01 Delta Spur A to Delta Spur B';
    const lookup = spanLookup({
      'Delta Spur A->Delta Spur B': ['Delta Main A', 'Delta Main B', 'Delta Spur A', 'Delta Spur B'],
    });
    const plan = await resolveLayer(
      layer([pin({ url: asUrl('https://youtu.be/samebr1'), title: spurTitle, channel: 'djsviews', shotType: 'drone' })]),
      emptyDecisions,
      catalogueFixture({ features: [mainA, mainB, spurA, spurB], creators: [djs] }),
      lookup,
      sessionMeta,
    );
    const cand = plan.pins[0]?.candidates[0];
    expect(cand?.kind).toBe('range');
    if (cand?.kind === 'range' && cand.span.kind === 'linked') {
      expect(cand.span.branchesPresent).toEqual(['main', 'spur']);
      expect(cand.span.branchChoiceNeeded).toBe(false);
      expect(cand.span.features.map((f) => f.id)).toEqual(['b3', 'b4']);
    }
    expect(plan.worklists.ranges[0]?.branchChoiceNeeded).toBe(false);
  });

  it('filters a mixed span to one branch when the choice names it', async () => {
    const decisions = foldDecisions([
      {
        kind: 'span',
        from: 'Delta Main A',
        to: 'Delta Spur B',
        choice: { kind: 'auto', branch: 'spur' },
      } as Decision,
    ]);
    const plan = await resolveBranch([mainA, mainB, spurA, spurB], decisions);
    const cand = plan.pins[0]?.candidates[0];
    if (cand?.kind === 'range' && cand.span.kind === 'linked') {
      expect(cand.span.branch).toBe('spur');
      expect(cand.span.branchesPresent).toEqual(['main', 'spur']);
      expect(cand.span.features.map((f) => f.id)).toEqual(['b3', 'b4']);
    }
    if (plan.pins[0]?.kind === 'insert') {
      expect(plan.pins[0].links.map((f) => f.id)).toEqual(['b3', 'b4']);
    }
  });

  it('offers no branch choice when the span is wholly on one branch', async () => {
    const mainTitle = '2026-01-01 Delta Main A to Delta Main B';
    const lookup = spanLookup({ 'Delta Main A->Delta Main B': ['Delta Main A', 'Delta Main B'] });
    const plan = await resolveLayer(
      layer([pin({ url: asUrl('https://youtu.be/mainonly1'), title: mainTitle, channel: 'djsviews', shotType: 'drone' })]),
      emptyDecisions,
      catalogueFixture({ features: [mainA, mainB], creators: [djs] }),
      lookup,
      sessionMeta,
    );
    const cand = plan.pins[0]?.candidates[0];
    if (cand?.kind === 'range' && cand.span.kind === 'linked') {
      expect(cand.span.branchesPresent).toEqual(['main']);
    }
    expect(plan.worklists.ranges[0]?.branchesPresent).toHaveLength(1);
    expect(plan.worklists.ranges[0]?.branchChoiceNeeded).toBe(false);
  });

  it('resolves an alias endpoint to the feature furthest from the other endpoint', async () => {
    const curzon = feature('w1', 'Curzon Street Station', 100, 'spur');
    const bromford = feature('w2', 'Bromford Tunnel', 10, 'main');
    const wwhOverbridge = feature('w3', 'Washwood Heath Rail Overbridge', 50, 'main');
    const saltley = feature('w4', 'Saltley Viaduct', 30, 'main');
    // Only the correct resolution (Curzon -> Bromford Tunnel, the end furthest away)
    // is keyed; picking the nearer Washwood Heath feature would miss it entirely.
    const lookup = spanLookup({
      'Curzon Street Station->Bromford Tunnel': [
        'Bromford Tunnel',
        'Saltley Viaduct',
        'Curzon Street Station',
      ],
    });
    const plan = await resolveLayer(
      layer([
        pin({
          url: asUrl('https://youtu.be/alias1'),
          title: '2026-01-01 Curzon Street Station to Washwood Heath',
          channel: 'djsviews',
          shotType: 'drone',
        }),
      ]),
      emptyDecisions,
      catalogueFixture({
        features: [curzon, bromford, wwhOverbridge, saltley],
        aliases: [['Washwood Heath', [bromford, wwhOverbridge]]],
        creators: [djs],
      }),
      lookup,
      sessionMeta,
    );
    const cand = plan.pins[0]?.candidates[0];
    expect(cand?.kind).toBe('range');
    if (cand?.kind === 'range' && cand.span.kind === 'linked') {
      expect([...cand.span.features.map((f) => f.id)].sort()).toEqual(['w1', 'w2', 'w4']);
    } else {
      throw new Error('expected a linked span from the resolved alias endpoint');
    }
  });

  it('flags a range endpoint that matches no feature or alias in the Titles worklist', async () => {
    const curzon = feature('f2b', 'Curzon Street Station', 100, 'spur');
    const plan = await resolveLayer(
      layer([
        pin({
          url: asUrl('https://youtu.be/badend1'),
          title: '2026-01-01 Curzon Street Station to Nowhere Junction',
          channel: 'djsviews',
          shotType: 'drone',
        }),
      ]),
      emptyDecisions,
      catalogueFixture({ features: [curzon], creators: [djs] }),
      noSpans,
      sessionMeta,
    );
    const unmatched = plan.worklists.unmatchedCandidates.map((c) => c.text);
    expect(unmatched).toContain('Nowhere Junction');
    expect(unmatched).not.toContain('Curzon Street Station');
  });
});

describe('resolveLayer: unmatched worklist and totality', () => {
  it('classifies a near-miss as a typo and an unknown name as alias-or-missing', async () => {
    const plan = await resolve(
      layer([
        pin({ url: asUrl('https://youtu.be/unmatch0001'), title: '2025-01-02 Wendover Dean Viaductt', channel: 'djsviews', shotType: 'drone' }),
        pin({ url: asUrl('https://youtu.be/unmatch0002'), title: '2025-01-02 Somewhere Totally Different', channel: 'djsviews', shotType: 'drone' }),
      ]),
    );
    const byText = Object.fromEntries(plan.worklists.unmatchedCandidates.map((u) => [u.text, u.verdict]));
    expect(byText['Wendover Dean Viaductt']).toBe('typo');
    expect(byText['Somewhere Totally Different']).toBe('alias-or-missing');
  });

  it('attaches parse warnings to their pin', async () => {
    const warning: ParseWarning = { pin: 0, kind: 'no-youtube-id', url: asUrl('https://vimeo.com/1') };
    const plan = await resolve(
      layer([pin({ ordinal: 0, url: asUrl('https://youtu.be/warnpin0001'), channel: 'djsviews', shotType: 'drone' })], [warning]),
    );
    expect(plan.pins[0]?.warnings).toEqual([warning]);
  });

  it('is total: an empty layer yields an empty, zeroed plan without throwing', async () => {
    const plan = await resolve(layer([]));
    expect(plan.pins).toEqual([]);
    expect(plan.summary).toMatchObject({ insert: 0, relink: 0, skipped: 0, linksPlanned: 0 });
    expect(plan.worklists.missingCreators).toEqual([]);
  });
});
