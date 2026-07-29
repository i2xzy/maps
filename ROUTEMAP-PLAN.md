# Route diagram editor — plan

A visual editor for the `{{Routemap}}` railway route diagrams on Wikipedia, intended to be
free and public for any Wikipedia editor. Companion to `TODOS.md`, which covers HS2.

Format follows `TODOS.md`: **What / Why / How / Depends on**. Numbers here are measured,
and the command that produces each is given so they can be re-checked rather than trusted.

---

## Where it stands

Measured against a committed fixture of **21 real Wikipedia diagrams (917 rows)** and
**17 whole `{{Routemap}}` calls**, not hand-written examples
(`packages/routemap/src/__fixtures__/`).

| | |
|---|---|
| rows surviving wikitext → model → wikitext unchanged in meaning | **93.7%** |
| …unchanged byte-for-byte | 79.6% |
| …exported unchanged **in practice**, via per-row provenance | **99.6%** |
| `{{Routemap}}` wrappers rebuilt byte-for-byte | **100%** (17/17) |
| BSicon cells the editor's semantic controls can edit | **~71%** |
| rows showing a muted placeholder for an unexpanded template | **~22%** |
| `{{rint}}` logo codes in the generated catalog | 2,130 (1,155 files, 266 needing credit) |
| tests | 653 package + 86 editor |

The corpus was corrected on 2026-07-28: the extractor had run to the end of the page rather
than the end of the `{{Routemap}}` call, counting 119 lines of `|map2 =`, `}}<noinclude>` and
`{{documentation}}` as rows. They round-tripped trivially, so removing them lowered the
ratios without anything regressing — 978/1036 passing became 859/917.

The first three are asserted as a floor in `from-wikitext.test.ts`, so they can only go up.

Working today: render from JSON, serialize to wikitext, parse wikitext back, an editable
wikitext panel that imports by paste and exports untouched rows byte-for-byte, editing
rows/cells/labels in forms, four label slots per side, a logo picker over the whole catalog,
licence credits, and static export.

---

## What MVP requires

A Wikipedia editor should be able to open an existing diagram, change it, and paste it back
**without making it worse**. Three properties, in priority order:

1. **Never silently lose or corrupt content.** Met: provenance means untouched rows export
   byte-for-byte, and unmodelled constructs are carried verbatim rather than dropped.
2. **Everything visible should be editable somewhere.** Not met — see the cell decoder and
   `{{BSsplit}}` items below. This is the honest MVP gap.
3. **Be reachable.** Not met — not deployed.

---

## High priority — MVP blockers

### Decode the BSicon codes the form can't edit
**What:** ~29% of cells in real diagrams decode to the raw `{ code }` passthrough, so the
form shows a thumbnail and the code but no controls. They render and round-trip correctly;
they just aren't editable except as text. Failure families, by share of all cells:

| share | family | examples |
|---|---|---|
| ~13% | unrecognised root/suffix | `SBHF`, `pBHF`, `BST`, `XBHF-L`, `eSHST` |
| ~~18.4%~~ | ~~colour suffix~~ — **fixed**, took cells 58.0% → 71.2% | `tSTR red`, `STRq green` |
| ~~11.0%~~ | ~~bare width prefix~~ — **fixed**, took cells 46.1% → 56.1% | `d`, `c`, `bs`, `s`, `cd`, `b` |
| 4.7% | parenthesised variant | `tPSTR(L)_red` |

**Why:** With no JSON pane in production, a cell the form can't edit is a cell nobody can
edit. This is the largest single gap between the tool and its purpose.
**How:** Two of the four families are DONE, and both were bigger than the labels suggested:
width prefixes (46.1% → 56.1%) and coloured variants (58.0% → 71.2%). Colour was the single
best change available — one optional field reaching 18% of cells — and it also unlocked codes
I had mis-filed as missing roots, `INTACC green` among them.

What's left has a much worse ratio, and the measurement said so before I spent anything on
it: **448 distinct cores**, with the top 18 reaching only half the failures. Adding the seven
recurring roots (`KRW`, `SHST`, `KBST`, `WASSER`, `INTACC`, `PORTAL`, `CSTR`) might buy 5–6%,
each a separate addition. Beyond them it is a very long tail.

So this item is DONE for MVP purposes, on the agreed basis that not every icon needs GUI
editing: what remains renders correctly, round-trips exactly, and is editable as wikitext.
Re-open it only if a specific diagram someone cares about is full of one family.
**Depends on:** Nothing. Each family is independent.
**Re-measure:** parse the fixture, run every cell through `codeToIcon`, count how many
yield a `kind`.

### Expand the templates the parser can't model
**What:** ~20% of rows contain a `{ raw }` run rendering as a muted, truncated placeholder.
**Why:** A fifth of every real diagram shows grey wikitext where a label should be. It
reads as broken even though nothing is lost.
**How:** Expand through `action=expandtemplates`, the way `{{rint}}` and `{{rws}}` already
are — `expandTemplate`, the in-flight promise cache and the resolver pattern all exist.
Measured which are worth it: **station links expand to plain wikilinks we already parse**
(`{{tram}}` 45, `{{stnlnk}}` 31, `{{stl}}` 19, `{{BSsrws}}` 9 — `{{tram|Derker}}` becomes
`[[Derker tram stop|Derker]]`), while **layout templates expand to HTML we can't render**
(`{{BSto}}` 33, `{{left}}` 14, `{{right}}` 4). Expand the first group, keep the placeholder
for the second. Parse the expansion with `parseLabelText` and do **not** recurse — a
placeholder inside an expansion is fine.
**Depends on:** Nothing.
**Caveat:** This adds an API call per distinct template instance. The catalog exists
precisely to avoid that for logos; consider whether the common station-link templates
deserve the same treatment before shipping it.

### Deploy
**What:** Vercel, on the free Hobby tier (explicitly non-commercial, which matches).
**Why:** Item 3 of MVP. The static export already builds.
**How:** Root directory set to `apps/routemap-editor`; no extraction from the monorepo
needed. `output: "export"` is already set, so the same `out/` works on Toolforge or Pages
later if Vercel ever stops suiting.
**Depends on:** The two items above, by judgement rather than necessity — deploying a tool
that can't edit half the cells invites a first impression that's hard to undo.
**Trap:** `next build` deletes `.next/static/development` even with a separate `distDir`,
so it breaks a running `next dev` and the dev server needs `.next` cleared and a restart.
Don't build against a dev server someone is using. Verified: a separate `distDir` does
**not** fix this.

---

## Medium priority

### Hide the fields and options that can't produce a real icon
**What:** The form offers whatever the MODEL can represent, and the model is generous:
`previewOptions({kind:"track"}, "curve")` yields `kSTR` and `kkSTR`, neither of which is a
file. Measured across the 2,638 modellable cells in the fixture:

| | |
|---|---|
| fields offered per icon, today | 15.6 |
| …if filtered to those with a real option | **8.4** (46% hidden) |
| options inside the SURVIVING fields that are dead | **51%** (66,303 / 129,171) |

So roughly half the form is choices that can only produce a broken image.
**Why:** It's the same complaint as the cell decoder, from the other end — not "this cell
can't be edited" but "these controls edit nothing". It also makes the `n more fields`
disclosure look worse than it is: most of what it hides was never usable.
**How:** Existence has to be baked; asking per render is an API call per option per
keystroke, the trap the `{{rint}}` catalog exists to avoid. Measured sizes for the
manifest, from a full crawl of Commons:

| representation | size |
|---|---|
| every `BSicon *.svg` on Commons (371,890) | 5.6 MB raw / 1.0 MB gzipped |
| …restricted to codes our encoder can emit (172,005) | 2.5 MB raw / 442 KB gzipped |
| …uncoloured only (108,670) | 1.5 MB raw / 275 KB gzipped |
| projected to (kind, field, value) seen on a real file | 6.1 KB raw / 0.9 KB gzipped |
| Bloom filter over the 172,005, 5% false positive | ~133 KB |

The 6.1 KB projection is tempting and **doesn't work**: `curve` appears on *some* real
track file, so a per-kind table keeps the field that a plain `STR` can't use. The win
needs per-code answers.

A Bloom filter is the right shape because its error direction matches the safety rule
below: it has no false negatives, so it can never hide something real, and a false
positive merely shows one dead option. Ship it as a static asset (`public/`), fetched
once and cached, rather than in the bundle — a `Set` of 172,005 strings also costs
~10–15 MB of heap, which matters on a phone.
**Safety rule, whichever representation wins:** a field or option that is **currently
set** is always offered. The manifest is a snapshot and Commons isn't the only source a
diagram's icons can come from, so absence of evidence must only ever remove a choice
nobody has made — never make existing content uneditable.
**Depends on:** Nothing. The generator exists
(`scripts/build-bsicon-manifest.mjs`, ~12 minutes, 744 API pages).
**Open:** whether the disclosure can then go. At 8.4 fields average it's arguable, but
the distribution has a fat tail — 995 of 2,638 icons still show 11–13 fields.

### `{{BSsplit}}` written as an explicit run isn't GUI-editable
**What:** A `{ split }` run makes the whole label fall back to "(Rich label — edit in
JSON)". So does a `{ raw }` run and a label carrying `title`.
**Why:** With no JSON pane, that's a label nobody can edit — and the fallback is
all-or-nothing, so one split makes the plain text around it unreachable too.
**How:** Three options, ascending. (a) Say *why* in the message rather than "Rich label" —
minutes, fixes nothing, stops it being mysterious. (b) An **atom node** like the logo and
station chips: the split becomes a selectable block edited via a popover, and the
surrounding text becomes editable again — about half a day. (c) A ProseMirror **node with
content** (`split` containing `splitLine`, the way a table contains rows), so the lines are
edited inline. That is the real answer, TipTap's table extension is the reference, and the
work is in the edges: caret in and out, Enter/Backspace at line boundaries, whole-node
selection. None of it is testable under jsdom, so it needs browser-driven tests.
**Depends on:** Nothing, but hold until the importer says how often explicit splits appear
in real diagrams. If it's ~1%, (a) is the right answer forever; if it's 15%, skip (b) and go
straight to (c).

### Row properties and other unmodelled constructs
**What:** Not in the model, so a GUI edit to the row would drop them: icon links
(`!@Superhub`), row properties (`bg=#7af`, row styles), `-colspan-2-style=`,
`-colspan-end`, collapsible rows, text cells inside icon rows (`*text` with width
prefixes), and `map2`/`map3` (carried verbatim as a wrapper param, but their rows aren't
parsed).
**Why:** Provenance protects rows nobody touched. It does **not** protect a row the user
edits — and these are all in real diagrams.
**How:** Work the remaining 58 round-trip differences; each one names a construct. Raise
the test floor as they close.
**Depends on:** Nothing.

### Mobile layout
**What:** The editor is a three-pane splitter at `100dvh`. Unusable on a phone.
**Why:** Wikipedia editing happens on phones. Not MVP, but it caps the audience.

---

## Low priority / deferred

- **Delete `migrate.ts`** once the format has been public for a while. It converts
  diagrams written against the pre-`{ icon }` label shape. Nothing was ever released with
  that shape, so its only remaining job is old files and clipboards — and carrying it
  indefinitely reads as though the format is still in flux.
- **Publish `@repo/routemap` to npm.** Only worth it if the HS2 site or a third party wants
  it. Currently `private: true` with no `main`/`types`/`files`, so it needs a build first.
- **Attribution beyond a link.** `logoCredits()` returns author, licence and a link to each
  Commons file page. CC 4.0 accepts a link to a resource carrying the required information,
  so this is sufficient; a fuller inline credit line would be belt-and-braces.

---

## Decisions already made

Recorded so they aren't relitigated. Each has a reason, and several were mistakes first.

- **The catalog is trusted over the live wiki.** Logos resolve from the generated snapshot;
  only `{{rws}}` station lookups hit the API, because station names can't be pre-baked.
  Asking the wiki as well meant an API call per logo per visitor against servers that
  rate-limit by returning an error page — so a busy day would make logos silently vanish.
  Regenerating is one command. Took API calls per page load from 10 to 2.
- **Semantic, not byte, fidelity is the row measure.** `Module:Routemap` trims every
  `~~`/`! !` field, so padding differences change nothing rendered. Byte fidelity is
  reported but not asserted.
- **Byte fidelity *is* the wrapper measure.** A wrapper param is opaque to us, so identical
  text is the only proof none was lost. Nothing is interpreted — not even `title`.
- **Provenance compares models, not text.** Comparing serialized output would agree exactly
  where the round-trip already works, and it's the rows that *don't* round-trip which most
  need their original preserved.
- **One representation per thing.** Logos were once both a whole-label `icons` field and a
  run-level one, and the two serialized identically — which is what made a wikitext reader
  impossible. Now `{ icon }` is a run, and so are `{ split }`, `{ br }` and `{ raw }`.
- **`Module:Routemap` is the spec, not its documentation.** The prose glosses over the two
  rules that matter: the left fields are read *backwards* from `! !` and the right *forwards*
  from the icons, and a lone field is always `main`, never `dist`.

---

## Traps worth not rediscovering

Each of these cost real time.

- **`~~~~` is a MediaWiki signature.** An empty label slot must be a space, never nothing.
- **`.RMsi` is `display: inline`** and the stylesheet says why: "HTML Tidy forced the use of
  div instead of span". So `remark` sits *beside* `main`, not under it.
- **`{{BSsplit}}` and `<br>` are not interchangeable.** A split carries `.RMsplit`, which is
  90%; `<br>` text stays full size. Measured 11.7px against 13px.
- **A pipe inside an object run is a line break to the serializer.** Preserving unknown
  wikitext as plain text turned `{{BSto|a|b}}` into `{{BSsplit|{{BSto|a|b}}}}`. Hence
  `{ raw }`. A literal pipe emits `{{!}}`.
- **`Category:BSicon` holds 13 files.** The icons aren't enumerable by category — they're
  spread over hundreds of descriptive subcategories with no root that lists them. The
  `BSicon ` *filename* prefix via `list=allimages` is the actual convention, and there are
  **371,890** of them, which is 10x what the category structure suggests.
- **`imagerepository`, not `missing`,** tells you whether a Commons file exists. Trusting
  `missing` cut the catalog from 1,126 entries to 29 while every survivor looked valid.
- **`pnpm format` reformats whole files.** The repo has no prettier config and isn't
  prettier-formatted, so it buries a change under whole-file churn.
- **React SSR emits `colSpan`, not `colspan`** — assertions need `/i`.
- **React preloads images in `<head>`,** so searching a whole document for an image URL
  finds the preload link and any ordering assertion passes vacuously.
- **A suspicious measurement is usually the instrument.** Three times this session a
  surprising number was a broken probe, not a broken feature: a dev server returning 500
  read as "zero requests", a CodeMirror token matched instead of the wikitext pane, and a
  round-trip harness that started measuring provenance instead of the parser.
