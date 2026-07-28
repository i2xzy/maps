import { describe, expect, it } from "vitest";
import type { SideLabel } from "@repo/routemap";
import {
  docToLabel,
  labelIcons,
  labelIsMultiLine,
  labelIsRteEditable,
  labelToDoc,
  logoInsertContent,
  setLabelIcons,
} from "./label-doc";

describe("labelIsRteEditable", () => {
  it("accepts empty, plain string, and bold/italic/link runs", () => {
    expect(labelIsRteEditable(null)).toBe(true);
    expect(labelIsRteEditable("Euston")).toBe(true);
    expect(labelIsRteEditable([{ text: "x", bold: true }, { text: "y", link: true }])).toBe(true);
    expect(labelIsRteEditable({ text: "x", italic: true })).toBe(true);
  });

  it("accepts rws station links (they have a node now)", () => {
    expect(labelIsRteEditable([{ rws: "Liverpool|Lime Street" }])).toBe(true);
    expect(labelIsRteEditable({ rws: "Birmingham New Street" })).toBe(true);
    expect(labelIsRteEditable(["to ", { rws: "Euston" }])).toBe(true);
  });

  it("accepts icons — inline ones are nodes, whole-label ones are the strip", () => {
    expect(labelIsRteEditable({ text: "x", icons: ["gb|rail"] })).toBe(true);
    expect(labelIsRteEditable([{ text: "x", icons: ["air"] }])).toBe(true);
  });

  it("rejects a title, which the editor has no way to represent", () => {
    // Without this the fallback would silently drop it on the first keystroke.
    expect(labelIsRteEditable({ text: "x", title: "hover" })).toBe(false);
    expect(labelIsRteEditable([{ text: "x", title: "hover" }])).toBe(false);
  });
});

describe("labelIcons / setLabelIcons", () => {
  it("reads whole-label icons, and only those", () => {
    expect(labelIcons({ text: "Euston", icons: ["gb|rail"] })).toEqual(["gb|rail"]);
    expect(labelIcons("Euston")).toEqual([]);
    // An icon on a RUN belongs to the document, not the strip.
    expect(labelIcons([{ text: "Euston", icons: ["gb|rail"] }])).toEqual([]);
  });

  it("attaches icons to text of any shape", () => {
    expect(setLabelIcons("Euston", ["gb|rail"])).toEqual({ text: "Euston", icons: ["gb|rail"] });
    expect(setLabelIcons(["a", "|", "b"], ["air"])).toEqual({ text: ["a", "|", "b"], icons: ["air"] });
    // Icons with no text at all are still a label worth keeping.
    expect(setLabelIcons(undefined, ["air"])).toEqual({ icons: ["air"] });
  });

  it("keeps the label's other fields when only the icons change", () => {
    expect(setLabelIcons({ text: "Euston", link: true, italic: true }, ["gb|rail"])).toEqual({
      text: "Euston",
      link: true,
      italic: true,
      icons: ["gb|rail"],
    });
  });

  it("collapses back to bare text when the last icon is removed", () => {
    expect(setLabelIcons({ text: "Euston", icons: ["gb|rail"] }, [])).toEqual({ text: "Euston" });
    expect(setLabelIcons({ icons: ["gb|rail"] }, [])).toBeUndefined();
    expect(setLabelIcons("Euston", [])).toBe("Euston");
  });
});

describe("labelIsMultiLine", () => {
  it("is true when a `|` splits the label into lines", () => {
    expect(labelIsMultiLine("foo|bar")).toBe(true);
    expect(labelIsMultiLine(["foo", "|", "bar"])).toBe(true);
    expect(labelIsMultiLine({ text: [{ text: "a|b", bold: true }] })).toBe(true);
  });

  it("is false for one line, escaped pipes included", () => {
    expect(labelIsMultiLine(null)).toBe(false);
    expect(labelIsMultiLine("Euston")).toBe(false);
    expect(labelIsMultiLine({ text: "Euston", icons: ["gb|rail"] })).toBe(false);
    // `\\|` is a literal pipe in the text, not a line break — and a pipe inside an
    // icon CODE is not label text at all.
    expect(labelIsMultiLine("a\\|b")).toBe(false);
    expect(labelIsMultiLine([{ rws: "Liverpool|Lime Street" }])).toBe(false);
  });
});

describe("labelToDoc → docToLabel round-trips", () => {
  const round = (label: SideLabel | undefined) => docToLabel(labelToDoc(label));

  it("plain string collapses back to a string", () => {
    expect(round("Delta Junction")).toBe("Delta Junction");
  });

  it("keeps per-run bold and italic", () => {
    expect(round([{ text: "A", bold: true }, "B"])).toEqual([{ text: "A", bold: true }, "B"]);
    // A single marked run stays an array (it can't collapse to a plain string).
    expect(round([{ text: "A", italic: true }])).toEqual([{ text: "A", italic: true }]);
  });

  it("keeps a run link (true when href equals the text)", () => {
    expect(round([{ text: "Euston", link: true }])).toEqual([{ text: "Euston", link: true }]);
    expect(round([{ text: "Home", link: "Euston" }])).toEqual([{ text: "Home", link: "Euston" }]);
  });

  it("folds a label-level link/italic onto the run", () => {
    expect(round({ text: "Euston", link: true })).toEqual([{ text: "Euston", link: true }]);
    expect(round({ text: "note", italic: true })).toEqual([{ text: "note", italic: true }]);
  });

  it("represents multi-line text with a | separator run", () => {
    const doc = labelToDoc("line1|line2");
    expect(doc.content).toHaveLength(2); // two paragraphs
    expect(docToLabel(doc)).toEqual(["line1", "|", "line2"]);
  });

  it("escapes a literal pipe in FORMATTED text too, not just plain text", () => {
    // Typing "A|B" in bold must stay one bold line; unescaped, the renderer reads
    // the pipe as a BSsplit break and stacks it into two lines.
    const label = docToLabel({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A|B", marks: [{ type: "bold" }] }] },
      ],
    });
    expect(label).toEqual([{ text: "A\\|B", bold: true }]);
    expect(labelToDoc(label!).content).toHaveLength(1); // still one line
  });

  it("treats a pipe in a formatted run as a line break when it is unescaped", () => {
    // Hand-written JSON with a raw pipe: the renderer breaks the line there, so the
    // editor has to show two lines or it would silently disagree with the preview.
    expect(labelToDoc([{ text: "A|B", bold: true }]).content).toHaveLength(2);
  });

  it("escapes a literal pipe so it is not a line break", () => {
    // A single line whose text contains a literal pipe.
    const label = docToLabel({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a|b" }] }],
    });
    expect(label).toBe("a\\|b");
    // …and it round-trips as one line, not two.
    expect(labelToDoc(label!).content).toHaveLength(1);
  });

  it("round-trips an rws station run through an rws node", () => {
    expect(round([{ rws: "Liverpool|Lime Street" }])).toEqual([{ rws: "Liverpool|Lime Street" }]);
    expect(round(["to ", { rws: "Euston" }])).toEqual(["to ", { rws: "Euston" }]);
  });

  it("folds a whole-label rws (no text) into a station run", () => {
    expect(round({ rws: "Birmingham New Street" })).toEqual([{ rws: "Birmingham New Street" }]);
  });

  it("empty doc → undefined (clears the label)", () => {
    expect(docToLabel({ type: "doc", content: [{ type: "paragraph" }] })).toBeUndefined();
  });

  it("keeps a run's icons attached to that run, not split off", () => {
    expect(round([{ text: "Euston", icons: ["gb|rail"] }])).toEqual([
      { text: "Euston", icons: ["gb|rail"] },
    ]);
    // Several logos on one run stay in order on that run.
    expect(round([{ text: "Euston", link: true, icons: ["gb|rail", "london|underground"] }])).toEqual([
      { text: "Euston", link: true, icons: ["gb|rail", "london|underground"] },
    ]);
  });

  it("promotes a plain string run so it can carry trailing icons", () => {
    expect(round(["to ", { icons: ["air"] }])).toEqual([{ text: "to ", icons: ["air"] }]);
  });

  it("keeps a station run's own icons", () => {
    // An rws run is atomic, so its icons become a following run — render-equivalent,
    // since a run's icons trail it either way. What must NOT happen is losing them.
    expect(round([{ rws: "Euston", icons: ["gb|rail"] }])).toEqual([
      { rws: "Euston" },
      { icons: ["gb|rail"] },
    ]);
    expect(round([{ rws: "Euston", icons: ["gb|rail", "london|underground"] }])).toEqual([
      { rws: "Euston" },
      { icons: ["gb|rail", "london|underground"] },
    ]);
  });

  it("keeps icons after a station link as their own run", () => {
    // An rws run's text comes from the wiki, so icons can't ride along on it.
    expect(round([{ rws: "Euston" }, { icons: ["gb|rail"] }])).toEqual([
      { rws: "Euston" },
      { icons: ["gb|rail"] },
    ]);
  });

  it("round-trips the non-code icon forms instead of flattening them", () => {
    expect(round([{ text: "x", icons: [{ file: "Custom logo.svg" }] }])).toEqual([
      { text: "x", icons: [{ file: "Custom logo.svg" }] },
    ]);
    expect(round([{ text: "x", icons: [{ rint: "air", size: 20 }] }])).toEqual([
      { text: "x", icons: [{ rint: "air", size: 20 }] },
    ]);
  });

  it("leaves whole-label icons out of the document (the strip owns them)", () => {
    const doc = labelToDoc({ text: "Euston", icons: ["gb|rail"] });
    expect(JSON.stringify(doc)).not.toContain("rint");
    expect(docToLabel(doc)).toBe("Euston");
  });

  it("puts an icon on its own line when the line starts with one", () => {
    expect(round(["a", "|", { icons: ["air"] }])).toEqual(["a", "|", { icons: ["air"] }]);
  });
});

describe("logoInsertContent", () => {
  const shape = (after: string) =>
    logoInsertContent("gb|rail", after)
      .map((n) => (n.type === "rint" ? "@" : JSON.stringify(n.text)))
      .join("");

  it("adds a trailing space when text follows the logo", () => {
    // Spacing is authored, not styled: `{{rint|x}}Euston` really does draw crushed.
    expect(shape("E")).toBe('@" "');
  });

  it("adds nothing when a space, a boundary, or another node follows", () => {
    expect(shape(" ")).toBe("@");
    expect(shape("")).toBe("@"); // end of line, or an adjacent logo / station node
  });

  it("never adds a LEADING space, because the serializer writes that one", () => {
    // A logo dropped after text joins that run's `icons`, and serialize.ts emits the
    // boundary space itself. Inserting one here too gave `Euston  {{rint|gb|rail}}`.
    const doc = labelToDoc("Euston");
    const para = doc.content![0]!;
    para.content = [...(para.content ?? []), ...logoInsertContent("gb|rail", "")];
    expect(docToLabel(doc)).toEqual([{ text: "Euston", icons: ["gb|rail"] }]);
  });

  it("puts the space in the document when the logo leads, since nothing else will", () => {
    // A leading logo becomes its own `{ icons }` run, which the serializer writes
    // with no space — so the space has to be real content.
    const doc = labelToDoc("Euston");
    const para = doc.content![0]!;
    para.content = [...logoInsertContent("gb|rail", "E"), ...(para.content ?? [])];
    expect(docToLabel(doc)).toEqual([{ icons: ["gb|rail"] }, " Euston"]);
  });
});

describe("<br> vs {{BSsplit}} in the document", () => {
  it("maps a hardBreak to a <br> run, not to a BSsplit line", () => {
    // Shift+Enter used to push "|" like Enter did, so both gestures produced a split
    // and nothing produced a <br>. They render at different sizes, so that was a
    // silent substitution rather than a shortcut.
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }],
        },
      ],
    };
    expect(docToLabel(doc)).toEqual(["a", { br: true }, "b"]);
  });

  it("still maps a paragraph boundary to a BSsplit line", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        { type: "paragraph", content: [{ type: "text", text: "b" }] },
      ],
    };
    expect(docToLabel(doc)).toEqual(["a", "|", "b"]);
  });

  it("round-trips a <br> run through the document", () => {
    const label = ["a", { br: true }, "b"];
    expect(docToLabel(labelToDoc(label as never))).toEqual(label);
  });

  it("keeps a <br>-bearing label editable, unlike one holding a split", () => {
    // A <br> has a node in the document (hardBreak); a split does not.
    expect(labelIsRteEditable(["a", { br: true }, "b"] as never)).toBe(true);
    expect(labelIsRteEditable([{ split: ["a", "b"] }] as never)).toBe(false);
  });

  it("starts a new run for an icon after a break, not on the break itself", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a" },
            { type: "hardBreak" },
            { type: "rint", attrs: { icon: "gb|rail" } },
          ],
        },
      ],
    };
    expect(docToLabel(doc)).toEqual(["a", { br: true }, { icons: ["gb|rail"] }]);
  });
});
