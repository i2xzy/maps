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
| rows surviving wikitext → model → wikitext unchanged in meaning | **100%** (917/917) |
| …unchanged byte-for-byte | 79.6% |
| …exported unchanged **in practice**, via per-row provenance | **99.6%** |
| `{{Routemap}}` wrappers rebuilt byte-for-byte | **100%** (17/17) |
| BSicon cells the editor's semantic controls can edit | **~71%** |
| rows showing a muted placeholder for an unexpanded template | **~22%** |
| `{{rint}}` logo codes in the generated catalog | 2,130 (1,155 files, 266 needing credit) |
| tests | 722 package + 88 editor |

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

### ~~Expand the templates the parser can't model~~ — station links done
**What:** Rows carrying a `{ raw }` run render a muted, truncated placeholder where label
text should be.

| | before | after |
|---|---|---|
| placeholders in the fixture | 260 | **67** (74% resolved) |
| rows showing one | 205/915 (22%) | **58/915 (6%)** |
| API requests for a whole diagram | would be 129 | **3** |

**How:** two families expand to something we can already render, and they share one batched
request because the renderer — not the fetch — decides how to read each expansion.

*Station links* (`{{tram}}`, `{{stl}}`, `{{stnlnk}}`, `{{stn}}`, 113 placeholders) become
plain wikilinks the parser already handles, so
`resolveText` substitutes the expansion into the runs *before* `buildLines` — links, marks
and splits then work through the existing path with no second rendering branch. Unresolved
(not fetched, or the request failed) leaves the placeholder, so it can only improve on it.

Batched: many calls share ONE `expandtemplates` request, joined by a separator that passes
through untouched, and the split is only trusted when the arity matches. That's the
difference between 113 requests and 3 — `{{rws}}` still does one per instance and could
adopt the same trick.

*File links* (`{{rmri}}`, `{{ric}}`, 26) expand to the same `[[File:…|Npx]]` shape as
`{{rint}}`, so `parseRintExpansion` reads them and they render through the existing logo
path. `link=` is dropped — a `{ file }` label icon has nowhere to put one; `{{rmri}}` emits
an empty link anyway, and `{{ric}}` losing a station link still beats grey wikitext.

**`{{BSto}}` is done, built from its arguments.** It expands to exactly the `.RMsplit`
two-row table we already model, so the renderer constructs that from the ARGS — **no API
call at all** — while the model keeps its `{ raw }` so the wikitext still round-trips byte for
byte. Verified in a browser: 0 `expandtemplates` requests for four `{{BSto}}` rows, computed
fontStyle italic on line 2 and normal on line 1, empty second line handled.

Measured against the live template, because the name misleads twice over: the **third
positional arg is a link target applied to both lines**, not a third line, and **`it=all` and
`it=none` expand identically** — so `it=` is ignored rather than guessed at. Line 1's 105% is
not modelled; the 90% split styling is.

**What remains, 67 placeholders across 58 rows (6%):**

| count | template | expands to | verdict |
|---|---|---|---|
| 14 + 4 | `{{left}}`, `{{right}}` | `<div style="float:…">X</div>` | wrapper; content is the label |
| 13 | `{{rcb}}` | `<span>` with inline colours | needs a styled-badge component |
| 9 | `{{BSsrws}}` | `<table>` + templatestyles | layout, keep the placeholder |
| 8 | bare wikitext | mixed | inspect individually |
| 6 | `{{float}}` | float span | wrapper |
| 6 | `{{0}}` | hidden-zero digit-width spacer | render a space |
| 6 | '''stl-call''' | a station link inside bold marks | the call isn't bare, so it stays raw |

The cheapest next one is a marked call like '''`{{stl|…}}`''' (6): the template is already
expandable, it just isn't a BARE call, so `textTemplateCall` rejects it. Unwrapping the marks
and re-applying them to the expansion would do it.

**Trap, twice over:** `{{BSsrws}}` reads exactly like a station link and expands to a `<table>` with
templatestyles. It was in the whitelist on the strength of its name until each expansion was
actually checked; `{{rcb}}` sits with `{{rmri}}`/`{{ric}}` and is equally unlike them; and
`{{enlarge}}` is the reverse — it reads like `{{small|x}}` and is really the magnifier glyph
`[[File:Gnome-searchtool.svg|10px|link=…]]`, with its argument as the link target.
Names are not evidence — hence the guard that rejects any expansion containing markup, and
the icon path falling back to the placeholder when an expansion holds no file.

### Deploy
**What:** Vercel, on the free Hobby tier (explicitly non-commercial, which matches).
**Why:** Item 3 of MVP. Nothing else matters if nobody can reach it.
**Status:** the artefact is verified, the publish is not done. `next build` produces a
working `out/`, and served statically it was driven end to end: 14 icon cells render, the
existence filter applies after its deferred chunk arrives (a plain cell hides 14 fields, not
the unfiltered 21), a `{{tram}}` station link resolves from the static page over CORS, and
the console is clean.
**How:** Vercel project with root directory `apps/routemap-editor`; framework preset Next.js;
no monorepo extraction needed. `output: "export"` is set, so the same `out/` also works on
Toolforge or Pages if Vercel stops suiting.
**Payload, measured on the real build:**

| | gzipped |
|---|---|
| first load | **629 KB** |
| …of which Chakra + lucide | 241 KB |
| BSicon filter, deferred after first paint | 203 KB |

The filter was a static import until it was measured: 268 KB of base64 that doesn't compress
sat in the page chunk, a third of an 834 KB first load, for something not needed until a cell
is selected. Fetched after first paint instead, first load is 629 KB. It's started on mount
rather than on first selection so it has arrived before anyone clicks a cell — and until it
does, `bsiconExists` answers `true`, so the form is briefly unfiltered rather than briefly
missing controls that work.

629 KB is still heavy for editors on slow connections, and it's now mostly framework rather
than data. Worth revisiting, but not a blocker.
**Trap:** `next build` deletes `.next/static/development` even with a separate `distDir`, so
it breaks a running `next dev` and the dev server needs `.next` cleared and a restart. Don't
build against a dev server someone is using. Verified: a separate `distDir` does **not** fix
this.

---

## Medium priority

### ~~Hide the fields and options that can't produce a real icon~~ — **done**
**What:** The form offered a control for anything the MODEL can represent, and the model is
generous: `previewOptions({kind:"track"}, "curve")` yields `kSTR` and `kkSTR`, neither of
which is a file. Half the form edited nothing.

| | before | after |
|---|---|---|
| fields offered per icon (fixture average) | 15.6 | **8.6** |
| dead options inside the surviving fields | 51% | **~0%** |
| `n more fields` for a plain `STR` | 21 | **14** |
| …for `ABZrg` | 5 | **1** |

**How it shipped:** a Bloom filter over the 172,005 codes that both exist on Commons and
our encoder can emit, at a 1% false-positive rate — 268 KB of base64, 203 KB gzipped.
Sized against the alternatives:

| representation | gzipped | fields hidden | dead options removed |
|---|---|---|---|
| exact code list | 442 KB | 46% | 51% |
| **Bloom 1%** | **203 KB** | **45%** | **51%** |
| Bloom 5% | 132 KB | 40% | 49% |
| (kind, field, value) table | 0.9 KB | ~0% | ~0% |

Two things that look cheaper and aren't. The **0.9 KB projection fails outright**: `curve`
appears on *some* real track file, so a per-kind table keeps the field a plain `STR` can't
use. And **Bloom bits don't compress** — they're ~50% dense by design, so unlike the rint
catalog (363 KB raw → 44 KB gzipped) the raw and wire sizes are nearly the same. Raw it's
smaller than the exact list; gzipped the gap narrows to 2x.

5% was rejected on measurement, not taste: a dead field survives if *any* of its options
false-positives, so the error rate is amplified per field — 5% per option cost 5 points of
field hiding (9.4 fields vs 8.6).

**Why a Bloom filter and not the list:** we only ever ask *membership*, never "list them".
That's what buys the size, and its error direction is the one we want — no false negatives,
so it can never hide an icon that really exists.
**Safety rule, load-bearing:** a field or option **currently set** is always offered,
whatever the filter says. It's a snapshot with a known error rate and Commons isn't the only
source a diagram's icons can come from, so absence of evidence only ever removes a choice
nobody has made. Tested.
**Left open:** the disclosure stays. At 14 hidden fields for a plain `STR` it still earns
its place — the hope that contextual filtering would remove the need for it didn't survive
the measurement, though `ABZrg` going 5 -> 1 shows how much less of a dumping ground it is.

### Enumerating every BSicon (for an icon picker) is a separate problem
**What:** A Bloom filter answers membership and **cannot be enumerated** — no listing, no
search, no autocomplete. So it can filter fields and can never power "insert any icon".
**Why it matters:** 199,885 of the 371,890 real files are codes our encoder can't even
produce. They render and round-trip fine as a raw `{ code }` cell, so a picker needs no
model support — just a way in, which the GUI currently lacks entirely ("Replace" swaps an
unmodellable code *for* a modelled one).
**How:** the full 371,890-code list is 1.0 MB gzipped — worth loading **only when a picker
opens**, the same bet the logo picker already makes with its 363 KB catalog. Local rather
than an API call because Commons' `aiprefix` is prefix-only: typing `BHF` would miss
`KBHFa`, which is usually what you wanted.
**Depends on:** nothing. The generator already produces the list (`.cache/`, gitignored).

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

### ~~Row properties~~ — **done**, and it was the whole remaining gap
**What:** The grammar allows one field past the fourth label slot —
`…~~rinfo4~~rowProps` — and it was being dropped. Real diagrams use it for `fontsize=main`
(51 rows) and `bg=#003399` (1).
**Outcome:** modelled as `props` on a grid row, carried verbatim and never interpreted, so
semantic fidelity is now **917/917 — 100%**, asserted exactly rather than as a ratio.
**Why it mattered more than 52/917 suggests:** provenance keeps an UNTOUCHED row byte-exact,
so these survived a paste. But one GUI edit re-serialized the row from the model, and
anything the model didn't hold was gone — a silently restyled row. That path is now tested in
the editor, not just the package.
**Serializer detail worth keeping:** a property forces all four slots to be written, as
space placeholders if empty, or the property lands in a label slot and silently relabels the
row. And a placeholder must be a space — `~~~~` is a MediaWiki signature.

### I misdiagnosed this twice before measuring properly
Recorded because the pattern keeps recurring. First I classified the 52 failures by grepping
the line for `*` and concluded "51 are text cells in the icon strip" — `*` merely co-occurs;
text cells round-trip fine as verbatim strings. Then I generalised from 6 printed examples to
the whole 51-row class and concluded most of the gap was a measurement artefact. Both wrong.
Diffing the canonical form of input against output — rather than eyeballing lines — said
`row property in the 5th field` immediately, and all 52 were one thing.

### The fidelity measurement was unsound, and is now slot-aware
**What:** `norm` in `from-wikitext.test.ts` trimmed each field and dropped trailing empties.
On the LEFT that's wrong — fields read backwards from `! !`, so a trailing field is the low
slot and dropping an empty one shifts everything: `A~~B! !STR` (dist=B, main=A) and
`A~~B~~! !STR` (main=B, remark=A) squashed to the same string.
**Outcome:** replaced with a slot-assignment canonicaliser transcribed from the module's
rules, independent of our parser. Measured both ways: the string version **overstated
nothing** — so the floor was never lying in the dangerous direction — and understated 6 rows.
93.7% -> 94.3%, floor raised 93% -> 94%.
**Trap worth keeping:** the first version of the new instrument dropped fields past the 4th
slot and reported a flat **100%**. Anything past slot 4 is a row property and has to be
carried. A measurement that agrees with itself isn't a measurement.

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
