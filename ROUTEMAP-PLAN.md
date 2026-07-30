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
| tests | 733 package + 98 editor |

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
| placeholders in the fixture | 260 | **32** (88% resolved) |
| rows showing one | 205/915 (22%) | **30/915 (3%)** |
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

**Layout wrappers are done too,** and they split into two groups that had to be told apart:

- **Content wrappers** — `{{left}}` 14, `{{right}}` 4, `{{float}}` 6, `{{small}}` 2. Their
  content IS the label, taken from the LAST positional arg (right for both shapes seen:
  `{{left|X}}` has one, and `{{float}}`'s named args come first). The positioning is dropped,
  as `{{small}}`'s 85% and `{{BSto}}`'s 105% are.
- **Spacers** — `{{0}}` 6, `{{pad}}` 3. Their argument is a MEASUREMENT, not content;
  treating `{{pad|1em}}` as a wrapper printed "1em" into the label. `{{0}}` hides a zero to
  reserve a digit's width, so U+2007 FIGURE SPACE is literally what it means.

**And the escaped pipe.** `{{float{{!}}15'}}` is `{{float|15'}}` — authors must escape the
separator because a real pipe would end the enclosing `{{Routemap|map=…}}` parameter, and the
call was unparseable as a result. Unescaped only when the parsed NAME still contains `{{!}}`,
because the other use of `{{!}}` is a VISIBLE pipe between two station links, and unescaping
`{{left|A {{!}} B}}` unconditionally would split it and silently drop "A".

**What remains, 32 placeholders across 30 rows (3%):**

| count | template | verdict |
|---|---|---|
| 13 | `{{rcb}}` | a `<span>` with inline colours — needs a styled-badge component |
| 9 | `{{BSsrws}}` | a `<table>` + templatestyles — genuine layout, keep the placeholder |
| 8 | bare wikitext | mixed; inspect individually |
| 2 | `{{center}}`, `{{BS1/2}}` | one each |

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

### Labels that can't be edited in the GUI: 23% -> 3%
**What:** A label containing a `{ split }`, a `{ raw }` run, or a `title` fell back to
"Rich label — edit in JSON". With no JSON pane in production that was a label nobody could
edit, and it was all-or-nothing: one `{{BSto}}` made the plain text around it unreachable too.

**Measured before deciding** — the number this item was waiting on:

| | labels | rows |
|---|---|---|
| fell back | 280/1199 (23%) | 229/915 (25%) |
| cause: `{ raw }` | 241 | |
| cause: `{ split }` | 39 | |
| **now** | **39/1199 (3%)** | **36/915 (4%)** |

The plan here used to be a binary — "if ~1% say why in the message forever, if 15% go
straight to a node-with-content". The breakdown made it neither. A `{ raw }` run is OPAQUE by
definition, so it needs no editable content, only to exist as something the caret can pass
and the user can select and delete. That is an ATOM, exactly like the logo and station chips
that already existed, and it covers 241 of the 280.

**Done:** `raw-node.tsx`, an inline atom rendered as its own wikitext, truncated and muted so
the chip and the thing on the diagram read as the same object. Verified in a browser: a label
reading `to {{BSto|Manchester|Leeds}} today` is editable, the chip renders as a node view, and
typing in the surrounding text preserved the raw run with its pipes intact — no `{{BSsplit}}`
wrapping, no page errors.
**Why it must be an atom and not text:** flattened into the document, `{{BSto|a|b}}` reads as
three lines to the serializer, which then wraps the whole label in a `{{BSsplit}}`. Tested.

### ~~No way to type an icon code in the GUI~~ — **done**
**What:** The BSicon code was read-only text. "Replace" could take you AWAY from an unmodelled
code, but nothing could take you TO one — so the ~200,000 real BSicons our encoder can't
build were reachable only through the wikitext pane.
**Done:** one editable code field per cell layer, at the layer level rather than inside
`IconFields`. A typed code goes through `codeToIcon`, so a code the model understands lights
up the controls below while anything else stays a code — the same rule the paste path uses.

Two things it fixed on the way:
- **One shape, one rule.** The field first lived inside `IconFields` for modelled cells and
  outside it for unmodelled ones, so typing `BHF` produced a bare string from one and
  `{ kind: "station" }` from the other. Now a typed code is always a code, and a
  `{ code, title }` ref keeps its metadata.
- **The existence warning was wrong,** and wrong in the worst direction — see below.

### Trap: `!bsiconExists(code)` does NOT mean "no such file"
The filter's keys are the codes that exist **and our encoder can emit**. So absence only
means "missing" for a code inside the encoder's range. `WASSERq` is a real icon on Commons
that our encoder can't build, so it was never a key — and the first version of the code field
read its absence as "no file on Commons", telling users their perfectly good code was broken.

`bsiconKnownMissing` is the honest question: outside the encoder's range it answers `false`,
because we have nothing to say. `bsiconExists` is only safe for codes we generated ourselves.
A wrong warning is worse than no warning.

### Dev-only: a hydration warning on load
React logs "Hydration failed…" on a plain dev-server load, with no interaction. Not from the
code field (it predates it and appears before anything is selected), and **absent from the
production build** — `next build` output served statically produces no pageerrors and no
console output at all. Chakra/Ark generate ids and the tests already show `data-ssr` lingering
under jsdom, so it's most likely that. Recorded rather than chased: it costs nothing in the
artefact that ships.

### The last 39: `{ split }` needs a node WITH content
**What:** The remaining 3%. A split's lines are editable text, which an atom can't hold.
**How:** a ProseMirror node containing `splitLine` children, the way a table contains rows —
TipTap's table extension is the reference. The work is all in the edges: caret in and out,
Enter/Backspace at line boundaries, whole-node selection. None of it is testable under jsdom,
so it needs browser-driven tests.
**Depends on:** Nothing, but 3% is a far weaker case than 23% was. Worth reconsidering
whether a simpler affordance — edit the split's lines in a small side panel rather than
inline — buys most of it for a fraction of the work.

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
