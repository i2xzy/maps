"use client";

/**
 * Transit-logo picker: a filterable grid of every logo we can draw, grouped into
 * categories (modes/facilities, then one per region).
 *
 * The grid is a `Listbox` over a `createGridCollection`, so arrow keys move in two
 * dimensions rather than down a list. Headings aren't collection items, so they
 * never take focus. Caveat: the collection treats the items as one dense 6-wide
 * grid, while a full-width heading forces each category to restart at column 1, so
 * wherever a category's size isn't a multiple of the column count, up/down lands a
 * column or two off across that boundary. Search is the primary way in, so this is
 * a papercut rather than a blocker; fixing it properly means padding each category
 * out to a whole row.
 *
 * Thumbnails come straight from the catalog's file names, so no API round-trip is
 * needed to browse; `loading="lazy"` keeps the ~1,100 off-screen images from being
 * fetched at all (Wikimedia throttles bulk requests hard — see
 * .context/rdt-spike/FINDINGS.md).
 *
 * Nothing here says "rint" or shows a template code: that's wiki-template plumbing,
 * and the picker's job is to let someone pick a logo by sight or by name. The
 * catalog is verified complete for what we can render, so there's no raw-code
 * fallback either — a logo that isn't here wouldn't draw.
 */
import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  Input,
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
  type RintCatalogEntry,
  type RintCatalogSection,
} from "@repo/routemap/rint-catalog";

const COLUMNS = 6;
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
          display="grid"
          gridTemplateColumns={`repeat(${COLUMNS}, 1fr)`}
          gap="1"
          p="1"
          maxHeight="240px"
          overflowY="auto"
        >
          {sections.map((section) => (
            <Fragment key={section.key}>
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
              {section.groups.map((group) => (
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
                      title={rintCatalogLabel(item)}
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
            </Fragment>
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
