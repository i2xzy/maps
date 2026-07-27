# Third-party content

The MIT licence in [`LICENSE`](./LICENSE) covers this repository's own source code. It
does not cover the content described below, which belongs to others and carries its
own terms.

## Wikipedia-derived data

`packages/routemap/src/rint-catalog.data.ts` is generated from
[Template:Rail-interchange][rint] on the English Wikipedia by
`packages/routemap/scripts/build-rint-catalog.mjs`. For each of the template's 2,130
logo codes it records the file the template produces, the display size, the link
target and the file's licence.

Wikipedia's text is CC BY-SA 4.0. This file extracts the factual mappings the template
encodes rather than copying its wikitext. Regenerate it with `pnpm build-rint-catalog`
in `packages/routemap`.

## Images are referenced, never redistributed

No BSicon or transit logo is stored in this repository. Both are fetched from Wikimedia
Commons at render time via `Special:FilePath`, so every image is served by Commons under
its own licence and nothing here redistributes any of them.

- **BSicons** — the track symbols the diagrams are built from. Simple geometric shapes;
  of 30 sampled, 29 were Public domain and 1 CC0, so none required attribution.
- **Transit logos** — the operator marks `{{rint}}` produces. Of the 1,155 distinct
  files in the catalog, 889 are attribution-free (Public domain, PD-\*, CC0) and **266
  are under a licence that requires credit** (CC BY, CC BY-SA, or unrecorded — unknown
  counts as requiring credit, which is the safe direction).

  `RINT_FILE_CREDITS` records each file's licence, its author, and the licence deed.
  Which files require a credit comes from Commons' own `AttributionRequired` flag, not
  from reading licence names. Every one of the 266 names an author, so a real credit can
  be rendered for all of them; the 13 files with no recorded author are public domain,
  where none is owed.

### If you display these logos, attribution is your responsibility

A CC BY or CC BY-SA image needs credit wherever it appears, and **there is no
non-commercial exemption** from that obligation — using the work for free, for
Wikipedia, or for education does not discharge it.

`logoCredits(files)` in `@repo/routemap/rint-catalog` returns what to publish for a set
of logos — author, licence, and a link to each file's Commons description page, deduped
and limited to the files that actually require one. It returns data rather than markup,
because only you know where a credit belongs on your page; rendering it is still yours
to do. The editor does so in its page footer.

Note that attribution is only owed where you display these images yourself. Wikitext
pasted into a Wikipedia article is Wikipedia's to attribute: the images live on Commons
and `[[File:…]]` links to their description pages.

Trademark is also separate from copyright. A permissive licence on the image file does
not grant any right to use an operator's mark in a way that implies endorsement.

`packages/routemap/demo/demo.png` is a screenshot of this renderer's own output and so
contains BSicons.

[rint]: https://en.wikipedia.org/wiki/Template:Rail-interchange
