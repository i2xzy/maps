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
| tests | 754 package + 117 editor |

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
| placeholders in the fixture | 260 | **0** (100% resolved) |
| rows showing one | 205/915 (22%) | **0/915** |
| API requests for a whole diagram | would be 129 | **3** |

**How:** two families expand to something we can already render, and they share one batched
request because the renderer — not the fetch — decides how to read each expansion.

*Station links* (`{{tram}}`, `{{stl}}`, `{{stnlnk}}`, `{{stn}}`, 113 placeholders) become
plain wikilinks the parser already handles, so
`resolveText` substitutes the expansion into the runs *before* `buildLines` — links, marks
and splits then work through the existing path with no second rendering branch. Unresolved
(not fetched, or the request failed) leaves the placeholder, so it can only improve on it.

Batched: many calls share ONE `expandtemplates` request, joined by a separator that passes
through untouched, and the split is only trusted when the arity matches. That's the difference
between 113 requests and 3.

`{{rws}}` now shares that request too. It was one per station — **309 across the corpus and 66
for a single diagram**, worse than the 10-to-2 saving the `{{rint}}` catalog exists to provide.
That diagram costs 2. Verified against the live API: 8 stations, 1 request, correct article
targets. Entries are memoised by args so a repeat hands back the SAME object — the editor
diffs the resolved map by identity to decide whether to re-render, which the promise cache
this replaced gave for free.

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

**Route badges, in colour.** `{{rcb|Sofia Metro|M2|croute}}` expands to a coloured pill
wrapping a link, and four fields are extracted from a shape checked against the live template:
link target, label, fill colour and text colour. Rendered as the pill itself.

The colour lives on a **render-local** run type (`BadgeRun`), not in the model. The model keeps
`{ raw }` and the wikitext is what round-trips, so a badge run cannot be spelled in a document
and cannot reach the serializer. Nothing is substituted unless the target, label AND fill all
parse — an unexpected shape falls back to a bold link, and failing that to the placeholder.

Two colour bugs, both found by looking at rendered output rather than at tests:
- **`\bcolor:` also matches inside `background-color:`** — the `-` is a word boundary — so the
  text colour came out equal to the fill and the label was invisible. The pattern now requires
  a `;` or `"` immediately before `color:`.
- **`.rm-link` sets `color: revert`** to restore the user agent's link blue, which beat the
  colour inherited from the pill: a blue route badge rendered blue-on-blue. The badge's text
  colour has to sit INLINE on the anchor. Both are asserted as properties now (fill ≠ text),
  not as fixed values.

This is also the ONE family allowed to return markup. The guard that rejects `<`/`>` is what
makes a misfiled name fail closed — it's what keeps `{{BSsrws}}` out — so the exception is by
name, and only because we parse `{{rcb}}`'s shape rather than render it.

**Nothing remains: 0 of 915 rows show a placeholder.** The last 19 were three patterns:

- **`{{BSsrws}}` (9)** — an `.RMsplit` table, so a split. Its lines can't be built from the args
  the way `{{BSto}}`'s can, because the article each line links to is derived the way `{{rws}}`
  derives one; only the expansion knows it. The `<td>`s are read out and each becomes a line.
  This had been filed as "genuine layout, keep the placeholder" purely because it expands to a
  `<table>` — it expands to a table because a split IS a table.
- **Marks wrapped round a whole template (8)** — `'''{{stl|…}}'''`, `''{{small|…}}''`,
  `''{{BSsplit|…}}''`. Handled by unwrapping, re-parsing the inside as a label, expanding THAT,
  and pushing the marks down onto the text runs it produced. Recursion rather than special
  cases, so a bolded station link, a bolded wrapper and a bolded split all take one route.
  A split run can't carry a mark itself, so its lines get them.
- **`{{center}}` and `{{BS1/2}}` (2)** — two more content wrappers, both verified.

**Caught in a browser, not by a test:** the render path handled marks correctly while the
COLLECTOR still asked `expandableCall` on the raw run — which isn't a bare call — so the inner
call was never fetched and the label stayed a placeholder regardless. `expandableCall` unwraps
marks; the per-family helpers deliberately do NOT, because the renderer routes a marked run
through its own branch to re-apply them, and matching through marks there would silently lose
the bold.

**Note on the mark handling:** a mark spanning the WHOLE field is lifted to a label-level
`italic`/`bold` by the parser and already worked. Only a field with other content keeps the
marks on the run — which is every real instance. Two tests were initially written against the
already-working shape and passed without touching the new code.

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

### ~~The last 39: `{ split }`~~ — 3% -> **0.8%**
**What:** A `{{BSsplit}}` label fell back to a dead-end message. The plan called for a
ProseMirror node WITH content — a split containing `splitLine` children, TipTap's table
extension as the reference — with all the work in the edges: caret in and out,
Enter/Backspace at line boundaries, whole-node selection, and browser-driven tests because
none of it works under jsdom.

**Measuring the 39 made that unnecessary for most of them.** 30 of 39 splits (77%) ARE the
whole label, with 2–4 lines of plain text and links. Every hard part of an inline node exists
only to edit a split sitting INSIDE running text — which is the other 9. So a whole-label
split gets **one editor per line**, reusing the existing RTE (links, marks and logos already
work in it), with add/remove-line buttons.

| | labels | rows |
|---|---|---|
| not editable, originally | 280/1199 (23%) | 229/915 (25%) |
| after the raw atom chip | 39 (3%) | 36 (4%) |
| **after per-line splits** | **9 (0.8%)** | **8 (0.9%)** |

**Details worth keeping:**
- Removing a line from a TWO-line split collapses it to the plain label — that's how you undo
  a split. It was disabled at two at first, which left the collapse branch unreachable.
- A line the RTE hands back can be the OBJECT form when it carries label-level marks, and a
  split line has nowhere to put those, so they're pushed down onto the runs they cover.
  Dropping them would silently un-italicise a line the moment its neighbour was edited.
- The dead-end message now says WHY and points at the wikitext panel, not at a JSON pane that
  isn't in the production build.

### ~~The last 9: a split among other runs~~ — **0 of 1199 labels now fall back**
**What:** `["to ", { split: […] }, " today"]` — the split shares its label with text, so
per-line fields alone couldn't offer that text.
**Done, by combining the two mechanisms already built rather than adding a third:**
- The split is an **atom chip** in the RTE (`split-node.tsx`), like the logo, station and raw
  chips. The caret steps over it, so the words either side are editable.
- Its **lines** get the same per-line editors, in a panel beneath the RTE.

That is what made a ProseMirror node-with-content unnecessary. Caret entry, Enter/Backspace at
line boundaries and whole-node selection all exist to type INTO the split inline — and none of
it is testable under jsdom. Editing the lines beside it needs none of them.

| | labels | rows |
|---|---|---|
| originally | 280/1199 (23%) | 229/915 (25%) |
| raw atom chip | 39 (3%) | 36 (4%) |
| whole-label per-line | 9 (0.8%) | 8 (0.9%) |
| **split atom + lines panel** | **0** | **0** |

**Ordering bug worth remembering:** making splits RTE-editable sent *every* split to the RTE
branch, so the whole-label per-line editor became unreachable. The whole-label case has to be
tested BEFORE `labelIsRteEditable`, not after. Three tests caught it, having been written
against the previous rules.

**Kept:** a split stays an ATOM rather than becoming the `|` paragraph-break sugar. Sugar
splits the whole label, which would move the words either side of it onto separate lines — the
one distinction the document genuinely can't hold.

### ~~Form values read as wire format, and defaults showed as `—`~~ — **done**
**What:** Two bugs in one place. Enum values were shown raw (`in-use`, `disused-primary`,
`three-quarter`), so the form read like a config file. And a field whose default is a real
option showed `—` as selected: a plain `BHF` displayed `—` for State when `in-use` is exactly
what a plain `BHF` is.
**Done:**
- **Proper case everywhere.** Hyphens become spaces and the first letter is capitalised, with
  four explicit exceptions the rule would get wrong — `sbahn` is "S-Bahn", `sBend` is "S-bend",
  and `gb`/`uk` are country codes, not words. Numbers stay numbers.
- **The default is DERIVED, not declared.** `defaultOptionOf` asks whether *clearing* the field
  changes the code; if an option produces the same code as no option, that option IS the
  default. It shows as selected and there's no separate unset entry, because a `—` beside
  `in-use` claimed nothing was chosen when something plainly was. Picking it still CLEARS the
  field, so choosing what was already true leaves the wikitext untouched.
- **Where no option means "unset", the unset state is named** — `defaultLabel`, set only where
  the domain gives a clear word (`width` → "Full", `formation` → "At grade") and otherwise
  "None", which is accurate without inventing a claim about what the icon then is.
- **Subtype gets the same rule**, which removed the last `—` in the form: it was the select's
  *placeholder*, showing whenever an icon had no subtype.

Verified in a browser, every field on a plain `STR`: Kind "Track", Subtype "None", System
"Rail", State "In use", Formation "At grade", Width "Full", and "None" for the rest. Zero values
showing a bare dash.

**Subtlety worth keeping:** the derivation asks about CLEARING, not about what's selected. A
junction's `to` has no default even though one is always set — clearing it gives `ABZg`, which
isn't an icon. An earlier probe compared each option to the icon's *current* code instead and
called `left` the default, which is a different question and the wrong one.

### ~~The `n more fields` disclosure~~ — named sections instead
**What:** One opaque disclosure. You couldn't tell whether the eleven things behind it were
worth opening, so the answer was always "click and scan".
**Done:** four named sections in a Chakra `Accordion` — **Appearance** (system, state,
formation, width, colour), **Direction** (to, from, corner, entry, level, lane, crosses…),
**Shape** (curve, parallel, transverse, interrupted…) and **Features** (legend, accessible,
doubleRow). A plain track's 14 controls read as 5 + 6 + 3 instead of "3 shown, 11 more".

I argued against grouping when the form had 23 fields, on the grounds that a menu of 20 names
is no better than a flat list. Existence filtering took it to 14, which is few enough for
sections to be a map rather than another maze — the earlier objection expired rather than
being wrong.

**Sections only when they help.** Below six controls the form lists them flat. A `spacer`
offers exactly one field (`width`), so a header there is a click you must make to reveal a
single control. Measured over the corpus's distinct icons: 53 offer five or fewer — including
cases with THREE sections holding three fields — while the bulk sit at 10–11, where the headers
are the point.

**Design choices worth keeping:**
- A field keeps its section whether or not it's set, so a control never moves under you. The
  in-use/unset split this replaced made `state` jump out of its group the moment you touched it.
- Sections holding a set field start open; if nothing is set, Appearance opens, or a fresh icon
  would show four headers and nothing else — worse than the disclosure.
- The grouping lives in `descriptor.ts` with an exhaustiveness test, because a field with no
  group would still render (the fallback is Appearance) but would be silently misfiled. The test
  asks `fieldHasGroup`, not `fieldGroup` — the latter falls back, so a test built on it would
  call every field grouped and pass whatever happened. Verified by removing an entry.

### Trap: `defaultValue` on an Accordion is read once
Switching from a track to a junction kept the TRACK's open sections, because `defaultValue` only
applies on mount. Keyed by `icon.kind` so it re-applies when the sections themselves change,
while the user's own open/close choices survive editing one icon. My comment claimed it already
worked per-icon; the browser said otherwise.

### A real bug this uncovered: a set field could be unreachable
`ABZrg` decodes to `{ kind: junction, to: right, direction: back }` — and `direction` is not a
junction field, so `fieldsFor` never made it a candidate and the form offered no way to see or
clear a value the icon plainly held. Two ordering errors, both against the documented safety
rule that a value in use is always offered:
1. `fieldIsOffered` checked the contextual visibility gate BEFORE the in-use test.
2. `offeredFields` only ever considered `fieldsFor(kind)`. It now unions in every field the icon
   actually holds.

### Mobile layout — deferred to the front-end rework
**What:** The editor is a three-pane splitter at `100dvh`. Unusable on a phone, and Wikipedia
editing happens on phones.
**Decision (2026-07-30):** not worth doing against the current layout. The JSON pane is being
removed, which changes the pane structure this problem is a property of — so the layout gets
solved as part of that rework rather than twice.
**Implication already acted on:** anything that told the user to "edit in JSON" was naming a
place that won't exist. Both instances are gone — the side-label fallback and the colspan one —
and a colspan row's rich text now goes through the same editor a side label does, since it's
the same `string | TextRun[]` shape.

---

## Low priority / deferred

- **Delete `migrate.ts`** once the format has been public for a while. It converts
  diagrams written against the pre-`{ icon }` label shape. Nothing was ever released with
  that shape, so its only remaining job is old files and clipboards — and carrying it
  indefinitely reads as though the format is still in flux.
- **Publish `@repo/routemap` to npm.** NOT needed for the HS2 app, which is in this monorepo
  and can consume the source export directly. Only worth it for a third party outside the repo,
  and then it needs `main`/`types`/`files` and a build.
- **Attribution beyond a link.** `logoCredits()` returns author, licence and a link to each
  Commons file page. CC 4.0 accepts a link to a resource carrying the required information,
  so this is sufficient; a fuller inline credit line would be belt-and-braces.

---

## Decisions already made

Recorded so they aren't relitigated. Each has a reason, and several were mistakes first.

- **JSON is the programmatic input, not an editing surface** (decided 2026-07-30). Two
  audiences, two formats. A Wikipedia editor works in the GUI and falls back to the **wikitext
  panel**; nothing user-facing mentions JSON any more. JSON is how another app — the HS2 app
  first — hands the package a diagram built from its own data.

  What follows from it: the model is a **public API**, so its shape and stability matter more
  than how pleasant it is to hand-edit, and `migrate.ts` becomes more load-bearing rather than
  less. `canonicalizeDiagram` ("Format") is a canonical form for that API, not a readability
  aid. And the wikitext panel has to stay: it's the fallback for anything the form can't model,
  and while nothing in the 21-diagram corpus still needs it, that is a statement about the
  corpus and not about Wikipedia.

  **Already consumable in-repo, verified:** `apps/hs2` needs only a `workspace:*` dep — the
  package exports `./src/index.ts` directly and the consuming app compiles it, so no build step.
  Nothing heavy is statically reachable from the barrel (16 modules, no data file): the 363 KB
  rint catalog is opt-in via the `./rint-catalog` entry, and the 268 KB BSicon filter is
  dynamically imported. A data-driven consumer pays for neither. `private: true` blocks npm
  publishing only, which nothing needs yet.
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
