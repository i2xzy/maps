"use client";

/**
 * Transit-logo picker: a filterable grid of every logo we can draw, grouped by country
 * and then by system.
 *
 * The grid is a `Listbox` over a `createGridCollection`, so arrow keys move in two
 * dimensions rather than down a list. Headings aren't collection items, so they never
 * take focus. Caveat: the collection treats the items as one dense 6-wide grid, while
 * a full-width heading restarts each category at column 1, so where a category's size
 * isn't a multiple of the column count, up/down lands a column or two off across that
 * boundary. Search is the primary way in, so it's a papercut rather than a blocker.
 *
 * BUILT A CATEGORY AT A TIME. Rendering all ~1,300 tiles up front cost ~430ms on open;
 * a section is now built when it nears the viewport, which opens in ~150ms. What made
 * that worth doing over the list virtualiser in Chakra's docs is that the docs' example
 * is a flat list of uniform rows, whereas this is a grouped grid — flattening it to
 * virtual rows would have split the `ItemGroup`s that give each system its accessible
 * name. Section granularity keeps those intact, needs no dependency, and skips the
 * same work. It still uses Ark's `scrollToIndexFn`, which is the sanctioned hook for
 * exactly this: a highlight can land in a section that hasn't been built, so the hook
 * reveals it and then scrolls once the element exists.
 *
 * An unbuilt section still reserves its height (`sectionHeight`), so the scrollbar is
 * honest and nothing jumps as sections fill in.
 *
 * Thumbnails come straight from the catalog's file names, so no API round-trip is
 * needed to browse; `loading="lazy"` keeps off-screen images from being fetched at all
 * (Wikimedia throttles bulk requests hard — see .context/rdt-spike/FINDINGS.md).
 *
 * Nothing here says "rint" or shows a template code: that's wiki-template plumbing,
 * and the picker's job is to let someone pick a logo by sight or by name.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Image,
  Input,
  Link,
  Listbox,
  Popover,
  Portal,
  Stack,
  Text,
  createGridCollection,
  useFilter,
} from "@chakra-ui/react";
import { logoUrl } from "@repo/routemap";
import {
  RINT_CATALOG,
  groupRintCatalog,
  rintCatalogLabel,
  rintCatalogSearchText,
  rintLicenceNeedsCredit,
  type RintCatalogEntry,
  type RintCatalogSection,
} from "@repo/routemap/rint-catalog";

const COLUMNS = 6;
// Enough sections to fill the 240px popover on open; the rest arrive as you scroll.
const SEED_SECTIONS = 4;
const CELL = "34px";

/**
 * Categories, and the text each entry is searched by, built once on first use.
 *
 * Both are derived from the WHOLE catalog so a logo keeps the same category no
 * matter what you search — narrowing to a single London logo should still show it
 * under "London", not shuffle it into the one-logo-region catch-all.
 *
 * Lazy, not module-level: this module is imported statically by the inspector, so
 * top-level work here would land on every page load and grind through ~1,100
 * entries even for a session that never opens the picker. That's the cost the
 * popover's `lazyMount` is there to avoid, and `lazyMount` only defers the JSX.
 */
let cachedIndex: {
  sections: RintCatalogSection[];
  searchText: Map<string, string>;
} | null = null;

function catalogIndex(): {
  sections: RintCatalogSection[];
  searchText: Map<string, string>;
} {
  cachedIndex ??= {
    sections: groupRintCatalog(RINT_CATALOG),
    searchText: new Map(
      RINT_CATALOG.map((e) => [e.code, rintCatalogSearchText(e).toLowerCase()]),
    ),
  };
  return cachedIndex;
}

// Tile box + grid gap, and the two heading heights — enough to reserve a section's
// space before the browser has laid it out.
// Calibrated against rendered sections rather than guessed: `31 + 24*headings +
// 38*rows` reproduced four measured sections exactly (183, 131, 431, 1059px).
const ROW_PX = 38;
const BANNER_PX = 31;
const HEADING_PX = 24;

/**
 * How tall a section will be, so an unrendered one still occupies its space.
 *
 * Walks the grid the way the browser will: a NAMED heading spans all six columns and
 * breaks the current row, while an unnamed one is `srOnly` — absolutely positioned,
 * out of flow — and doesn't. Summing `ceil(n / 6)` per group instead overestimated a
 * many-group country by a third, and a wrong reservation is what makes the scrollbar
 * jump as sections fill in.
 */
function sectionHeight(section: RintCatalogSection): number {
  let height = BANNER_PX;
  let col = 0;
  for (const group of section.groups) {
    if (group.named) {
      height += HEADING_PX;
      col = 0; // the heading spans the row, so its tiles restart at column 1
    }
    for (let i = 0; i < group.entries.length; i++) {
      if (col === 0) height += ROW_PX;
      col = (col + 1) % COLUMNS;
    }
  }
  return height;
}

/** A tile's tooltip: what the logo is, and the terms it comes under. */
function tileTitle(entry: RintCatalogEntry): string {
  const name = rintCatalogLabel(entry);
  if (!entry.licence) return name;
  return rintLicenceNeedsCredit(entry.licence)
    ? `${name} — ${entry.licence} (credit required)`
    : `${name} — ${entry.licence}`;
}

/**
 * The grid of logos. Calls `onPick` with the chosen logo's {{rint}} code — an
 * implementation detail of the caller's data model, not something shown here.
 *
 * Selection isn't held: picking inserts into the document and the popover closes,
 * so there's no selected state for the listbox to own.
 */
export function RintPicker({
  onPick,
}: {
  onPick: (code: string) => void;
}): ReactNode {
  const { contains } = useFilter({ sensitivity: "base" });
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const { sections: all, searchText } = catalogIndex();
    const q = query.trim();
    if (!q) return all;
    // `contains` is locale-aware (so "cercanias" finds "Cercanías"); the
    // precomputed lowercase text keeps the per-keystroke pass cheap.
    const keep = (entry: RintCatalogEntry) =>
      contains(searchText.get(entry.code) ?? "", q);
    return all
      .map((s) => ({
        ...s,
        groups: s.groups
          .map((g) => ({ ...g, entries: g.entries.filter(keep) }))
          .filter((g) => g.entries.length),
      }))
      .filter((s) => s.groups.length > 0);
  }, [query, contains]);

  // Which sections have been rendered. Only ever grows: once a section is on screen
  // there's nothing to gain by tearing it down, and keeping it avoids scroll thrash.
  // Seeded with enough to fill the popover, because IntersectionObserver fires async
  // and the first paint must already be right.
  const [rendered, setRendered] = useState<ReadonlySet<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionEls = useRef(new Map<string, HTMLElement>());

  // Where each section starts in the flat item order, so a keyboard highlight landing
  // in an unrendered section can bring it in.
  const sectionOfIndex = useMemo(() => {
    const bounds: { key: string; start: number }[] = [];
    let n = 0;
    for (const section of sections) {
      bounds.push({ key: section.key, start: n });
      n += section.groups.reduce((t, g) => t + g.entries.length, 0);
    }
    return (index: number) => {
      for (let i = bounds.length - 1; i >= 0; i--) {
        if (bounds[i]!.start <= index) return bounds[i]!.key;
      }
      return undefined;
    };
  }, [sections]);

  const reveal = (key: string | undefined) => {
    if (key == null) return;
    setRendered((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  };

  // `sections` is a fresh array on every render — `useFilter` hands back a new
  // `contains` each time, so the memo above can't hold. Keying the effects on the
  // joined section keys instead means they fire when the LIST changes, not when its
  // identity does. Without this, observing set state, which re-rendered, which
  // re-ran the effect: an infinite loop that hung the test suite.
  const sectionKeys = sections.map((s) => s.key).join("\u0000");

  // Filtering rebuilds the section list, so start again from the top of it.
  useEffect(() => {
    setRendered(new Set(sectionKeys.split("\u0000").slice(0, SEED_SECTIONS)));
  }, [sectionKeys]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting)
            reveal(e.target.getAttribute("data-section-key") ?? undefined);
        }
      },
      // A generous margin means sections are built before they scroll into view, so
      // scrolling never shows a blank gap.
      { root, rootMargin: "400px" },
    );
    for (const el of sectionEls.current.values()) io.observe(el);
    return () => io.disconnect();
  }, [sectionKeys]);

  // The collection is every logo in the order it's rendered, headings excluded, so
  // arrow-key navigation crosses category boundaries the way the eye does.
  const collection = useMemo(
    () =>
      createGridCollection({
        columnCount: COLUMNS,
        items: sections.flatMap((s) => s.groups.flatMap((g) => g.entries)),
        itemToValue: (item) => item.code,
        itemToString: (item) => rintCatalogLabel(item),
      }),
    [sections],
  );

  return (
    <Listbox.Root
      collection={collection}
      selectionMode="single"
      onValueChange={(e) => {
        const code = e.value[0];
        if (code) onPick(code);
      }}
      // Ark's hook for "scroll the highlighted item into view", which it hands to a
      // virtualiser so the two don't fight. Ours has to reveal the item's section
      // first: arrowing past what's been built lands on an item with no element yet,
      // and the default scroll finds nothing to scroll to. The element appears a
      // render later, hence the bounded retry — the same shape as the virtualiser
      // example in Chakra's docs.
      scrollToIndexFn={(details) => {
        reveal(sectionOfIndex(details.index));
        const scroll = (tries: number) => {
          const el = details.getElement();
          if (el) el.scrollIntoView({ block: "nearest" });
          else if (tries > 0) requestAnimationFrame(() => scroll(tries - 1));
        };
        scroll(10);
      }}
      width="292px"
    >
      <Stack gap="2">
        {/* `asChild` rather than `as`, so the Input keeps its own prop types (`as`
            erases them). Uncontrolled: the listbox owns the field's value for
            typeahead, we only mirror it into `query` to filter. */}
        <Listbox.Input asChild>
          <Input
            size="xs"
            autoFocus
            placeholder="Search logos…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </Listbox.Input>
        <Listbox.Content
          ref={scrollRef}
          p="1"
          maxHeight="240px"
          overflowY="auto"
        >
          {sections.map((section) => (
            /* Each section is its OWN grid rather than all of them sharing one.
               Two reasons: it gives the browser a single element per country to skip
               (`content-visibility`), and the columns still line up because every
               section uses the same template inside a fixed-width popover. */
            <Box
              key={section.key}
              data-section-key={section.key}
              ref={(el: HTMLElement | null) => {
                if (el) sectionEls.current.set(section.key, el);
                else sectionEls.current.delete(section.key);
              }}
              display="grid"
              gridTemplateColumns={`repeat(${COLUMNS}, 1fr)`}
              gap="1"
              // Unrendered sections still occupy their space, so the scrollbar is
              // honest and nothing jumps as they fill in.
              minHeight={
                rendered.has(section.key)
                  ? undefined
                  : `${sectionHeight(section)}px`
              }
            >
              {/* Country banner. A section holds one ItemGroup per system, and groups
                  can't nest, so the country is a plain full-width row above them. */}
              <Text
                gridColumn={`span ${COLUMNS}`}
                fontSize="xs"
                fontWeight="bold"
                color="fg"
                borderBottomWidth="1px"
                borderColor="border"
                mt="2"
                pb="0.5"
                px="0.5"
              >
                {section.label}
              </Text>
              {rendered.has(section.key) &&
                section.groups.map((group) => (
                  /* A real ItemGroup, not a styled Box: it wires `role="group"` and
               `aria-labelledby` to the label, so a screen reader announces which
               system the focused tile belongs to. `display: contents` keeps the tiles
               as direct grid children so the columns still line up. */
                  <Listbox.ItemGroup key={group.key} display="contents">
                    {/* Some groups carry no heading of their own — a country's pooled
                      one-logo systems, or a section with a single group. Keep the
                      label mounted but visually hidden so the group stays named for
                      assistive tech. */}
                    <Listbox.ItemGroupLabel
                      gridColumn={`span ${COLUMNS}`}
                      fontSize="2xs"
                      fontWeight="medium"
                      color="fg.muted"
                      pt="1"
                      px="0.5"
                      srOnly={!group.named}
                    >
                      {group.label}
                    </Listbox.ItemGroupLabel>
                    {group.entries.map((item) => (
                      <Listbox.Item
                        item={item}
                        key={item.code}
                        title={tileTitle(item)}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        width={CELL}
                        height={CELL}
                        borderRadius="sm"
                        cursor="pointer"
                        _hover={{ bg: "bg.muted" }}
                        _highlighted={{ bg: "bg.emphasized" }}
                      >
                        {/* Fixed box, contained image: catalog logos range from a 10px
                      roundel to a 32px wordmark, and a grid of mixed heights reads
                      as broken. */}
                        <Image
                          src={logoUrl(item.file)}
                          alt={rintCatalogLabel(item)}
                          loading="lazy"
                          maxWidth="26px"
                          maxHeight="22px"
                          objectFit="contain"
                        />
                      </Listbox.Item>
                    ))}
                  </Listbox.ItemGroup>
                ))}
            </Box>
          ))}
          {/* Listbox.Empty renders itself only when the collection is empty. */}
          <Listbox.Empty
            gridColumn={`span ${COLUMNS}`}
            px="1"
            py="3"
            fontSize="xs"
            color="fg.muted"
          >
            No logo matches “{query}”.
          </Listbox.Empty>
        </Listbox.Content>
        {/* These are other people's images. A quarter of them are CC BY-SA or CC BY,
            which obliges a credit, and a tile is a listbox option so it can't hold a
            link without breaking selection — hence a footer rather than per-tile
            links. Each logo's own licence is in its tooltip, and the file page it
            points to carries the author and the full terms. */}
        <Text fontSize="2xs" color="fg.subtle" px="0.5">
          Logos from{" "}
          <Link
            href="https://commons.wikimedia.org/wiki/Category:Public_transport_icons"
            target="_blank"
            rel="noreferrer"
            colorPalette="blue"
          >
            Wikimedia Commons
          </Link>{" "}
          and Wikipedia, under the licence shown on each logo.
        </Text>
      </Stack>
    </Listbox.Root>
  );
}

/**
 * `trigger` opens the picker in a popover; picking calls `onPick` and closes.
 *
 * Both places you can add a logo — the editor toolbar and a label's outer-edge
 * strip — want exactly this, so the popover lives here rather than being written
 * twice. `lazyMount`/`unmountOnExit` matter: the picker builds a grid over the whole
 * catalog, and without them every label slot on the panel would build one while
 * closed.
 */
export function RintPickerPopover({
  trigger,
  onPick,
}: {
  trigger: ReactNode;
  onPick: (code: string) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: "bottom-start" }}
      lazyMount
      unmountOnExit
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="auto">
            <Popover.Body p="2">
              <RintPicker
                onPick={(code) => {
                  onPick(code);
                  setOpen(false);
                }}
              />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
