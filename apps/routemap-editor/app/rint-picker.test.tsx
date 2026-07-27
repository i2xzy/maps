import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { RintPicker } from "./rint-picker";
import { renderWithChakra } from "./test-utils";

/**
 * Ark's listbox state machine doesn't respond to synthetic pointer OR keyboard
 * events under jsdom (reproducible with a three-item listbox and nothing of ours
 * involved), so choosing a tile can't be driven here — it's verified in a browser.
 * What these tests own is everything up to that boundary: which tiles exist, how
 * they're grouped, the filtering, and the `data-value` each tile carries, since
 * that value is exactly what the machine hands to `onValueChange` → `onPick`.
 */
const tiles = (): HTMLElement[] => screen.queryAllByRole("option");
const search = (): HTMLElement => screen.getByPlaceholderText("Search logos…");
// Names aren't unique — `gb|rail` and `london|rail` are both "National Rail" — so
// take the first match by name, and address a specific entry by its code.
// Anchored, because getByRole matches the accessible name as a substring.
const tile = (name: string): HTMLElement =>
  screen.getAllByRole("option", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) })[0]!;
const tileByCode = (code: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-scope="listbox"][data-value="${code}"]`)!;
// A country banner, as opposed to a system heading — pooled groups repeat their
// country's name in a visually hidden label, so match on the visible one.
const banner = (name: string): HTMLElement =>
  screen
    .getAllByText(name, { exact: true })
    .find((el) => el.getAttribute("data-part") !== "item-group-label")!;
const systemHeading = (name: string): HTMLElement =>
  screen
    .getAllByText(name, { exact: true })
    .find((el) => el.getAttribute("data-part") === "item-group-label")!;

describe("RintPicker", () => {
  it("shows the catalog as a grid of logos", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    expect(tiles().length).toBeGreaterThan(900);
    expect(tile("London Underground")).toBeTruthy();
  });

  it("names logos rather than exposing the wiki template code", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    // The {{rint}} code is the data model, not something an author should read.
    expect(document.body.textContent).not.toMatch(/\{\{|rint/i);
    // The tooltip names the logo, its terms and its author — never the code.
    expect(tileByCode("gb|rail").getAttribute("title")).toBe(
      "National Rail — Public domain by Gerry Barney of Design Research Unit",
    );
  });

  it("groups logos by country and then by system, modes first", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    // Country banners…
    expect(banner("United Kingdom")).toBeTruthy();
    expect(banner("Japan")).toBeTruthy();
    // …each holding its systems.
    expect(systemHeading("London")).toBeTruthy();
    expect(systemHeading("Tokyo")).toBeTruthy();
    // "General" leads; countries follow it in the DOM.
    const text = document.body.textContent ?? "";
    expect(text.indexOf("General")).toBeLessThan(text.indexOf("United Kingdom"));
  });

  it("expands region abbreviations into readable system names", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    // The raw args are "gb", "nsw" and "westmidlands" — never shown as such.
    expect(systemHeading("Great Britain")).toBeTruthy();
    expect(systemHeading("New South Wales")).toBeTruthy();
    expect(systemHeading("West Midlands")).toBeTruthy();
  });

  it("gives every system an accessible group, named by its heading", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    // Real Listbox.ItemGroups, so a screen reader can say which system a tile is in.
    const groups = screen.getAllByRole("group");
    expect(groups.length).toBeGreaterThan(100);
    expect(groups.some((g) => g.textContent?.startsWith("London"))).toBe(true);
  });

  it("filters by display name", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    const all = tiles().length;
    fireEvent.change(search(), { target: { value: "thameslink" } });
    const found = tiles();
    expect(found.length).toBeLessThan(all);
    expect(found.every((t) => /thameslink/i.test(t.getAttribute("title") ?? ""))).toBe(true);
  });

  it("filters by the underlying code too, not just the pretty name", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    // "gb rail" matches the code `gb|rail`, whose name is "National Rail".
    fireEvent.change(search(), { target: { value: "gb rail" } });
    expect(tileByCode("gb|rail")).toBeTruthy();
  });

  it("ignores accents, so a plain-ASCII query still finds the logo", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    fireEvent.change(search(), { target: { value: "cercanias" } });
    expect(tiles().length).toBeGreaterThan(0);
  });

  it("drops countries and systems that the filter emptied", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    expect(banner("Japan")).toBeTruthy();
    expect(systemHeading("Tokyo")).toBeTruthy();
    fireEvent.change(search(), { target: { value: "thameslink" } });
    expect(screen.queryByText("Tokyo")).toBeNull();
    expect(screen.queryByText("Japan")).toBeNull();
  });

  it("keeps a logo under its own country and system when filtered to one", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    fireEvent.change(search(), { target: { value: "london underground" } });
    // Categories come from the whole catalog, so a lone survivor keeps its place
    // in the hierarchy instead of being re-filed.
    expect(banner("United Kingdom")).toBeTruthy();
    expect(systemHeading("London")).toBeTruthy();
  });

  it("reports when nothing matches", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    fireEvent.change(search(), { target: { value: "zzzznotalogo" } });
    expect(tiles()).toHaveLength(0);
    expect(screen.getByText(/No logo matches/)).toBeTruthy();
  });

  it("gives each tile its logo code as the value, which is what gets picked", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    // `onPick` receives this value verbatim, so a wrong mapping here is the one
    // way the picker could hand back a code that doesn't resolve.
    expect(tile("London Underground").getAttribute("data-value")).toBe("london|underground");
    expect(tileByCode("london|underground")).toBe(tile("London Underground"));
  });

  it("credits where the logos came from", () => {
    // These are other people's images and roughly a quarter are CC BY-SA or CC BY,
    // which obliges a credit. A tile is a listbox option and can't hold a link
    // without breaking selection, so the credit is a footer.
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    const credit = screen.getByRole("link", { name: /Wikimedia Commons/ });
    expect(credit.getAttribute("href")).toContain("commons.wikimedia.org");
    expect(credit.getAttribute("rel")).toContain("noreferrer");
  });

  it("puts each logo's licence and author in its tooltip, flagging the ones needing credit", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    const titles = tiles()
      .map((t) => t.getAttribute("title") ?? "")
      .filter((t) => / — /.test(t));
    // Every catalogued licence surfaces somewhere…
    expect(titles.length).toBeGreaterThan(0);
    // …and the attribution-bearing ones say so, while public domain doesn't.
    expect(titles.some((t) => /\(credit required\)$/.test(t))).toBe(true);
    expect(titles.some((t) => /— Public domain( by .+)?$/.test(t))).toBe(true);
    // The author is named too — a licence alone doesn't tell you who to credit.
    expect(titles.some((t) => / by .+/.test(t))).toBe(true);
  });

  it("renders a thumbnail per tile straight from the catalog, lazily", () => {
    renderWithChakra(<RintPicker onPick={vi.fn()} />);
    fireEvent.change(search(), { target: { value: "thameslink" } });
    const img = tile("Thameslink").querySelector("img");
    // Browsing must not depend on the wiki API, and off-screen tiles must not be
    // fetched at all — Wikimedia throttles bulk requests.
    expect(img?.getAttribute("src")).toContain("Special:FilePath/ThameslinkSymbol.svg");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });
});
