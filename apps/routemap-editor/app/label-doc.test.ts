import { describe, expect, it } from "vitest";
import type { SideLabel } from "@repo/routemap";
import {
  docToLabel,
  labelIsRteEditable,
  labelToDoc,
  logoInsertContent,
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

  it("accepts a logo, which is a node in the document like anything else", () => {
    expect(labelIsRteEditable([{ icon: "gb|rail" }, " ", "x"] as never)).toBe(true);
  });

  it("rejects a title, which the editor has no way to represent", () => {
    // Without this the fallback would silently drop it on the first keystroke.
    expect(labelIsRteEditable({ text: "x", title: "hover" })).toBe(false);
    expect(labelIsRteEditable([{ text: "x", title: "hover" }])).toBe(false);
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

  it("round-trips logo runs in order, as runs like any other", () => {
    // No attachment rules left: an icon used to be a field on the preceding run, so
    // the converter promoted plain strings to hold one and special-cased rws runs that
    // couldn't. Now it is simply a run, and order is the whole story.
    expect(round(["to ", { icon: "air" }])).toEqual(["to ", { icon: "air" }]);
    // Adjacent plain text coalesces (" " + "Euston" -> " Euston"), which is the same
    // wikitext in fewer runs — the round-trip preserves meaning, not run boundaries.
    expect(round([{ icon: "gb|rail" }, " ", { icon: "london|underground" }, " ", "Euston"])).toEqual(
      [{ icon: "gb|rail" }, " ", { icon: "london|underground" }, " Euston"],
    );
  });

  it("keeps a logo next to a station link without merging them", () => {
    // An rws run is atomic — its text comes from the wiki — and a logo beside it is
    // just the next run, so nothing has to be merged or promoted.
    expect(round([{ rws: "Euston" }, " ", { icon: "gb|rail" }])).toEqual([
      { rws: "Euston" },
      " ",
      { icon: "gb|rail" },
    ]);
  });

  it("round-trips the non-code icon forms instead of flattening them", () => {
    // `size`/`alt` live on the LabelIcon, so the run stays `{ icon }` whatever shape
    // the icon itself takes.
    expect(round([{ icon: { file: "Custom logo.svg" } }])).toEqual([
      { icon: { file: "Custom logo.svg" } },
    ]);
    expect(round([{ icon: { rint: "air", size: 20 } }])).toEqual([
      { icon: { rint: "air", size: 20 } },
    ]);
  });

  it("puts an icon on its own line when the line starts with one", () => {
    expect(round(["a", "|", { icon: "air" }])).toEqual(["a", "|", { icon: "air" }]);
  });
});

describe("logoInsertContent", () => {
  const shape = (before: string, after: string) =>
    logoInsertContent("gb|rail", before, after)
      .map((n) => (n.type === "rint" ? "@" : JSON.stringify(n.text)))
      .join("");

  it("spaces BOTH sides when text abuts the logo", () => {
    // Runs concatenate with nothing between them, so if these spaces aren't real
    // content nothing else supplies them and the logo touches the text.
    expect(shape("n", "E")).toBe('" "@" "');
  });

  it("adds no space where there already is one", () => {
    expect(shape(" ", " ")).toBe("@");
    expect(shape("", "")).toBe("@"); // start and end of a line
  });

  it("spaces only the side that needs it", () => {
    expect(shape("n", "")).toBe('" "@');
    expect(shape("", "E")).toBe('@" "');
  });

  it("round-trips to a logo run with the authored spaces intact", () => {
    const doc = labelToDoc("Euston");
    const para = doc.content![0]!;
    para.content = [...(para.content ?? []), ...logoInsertContent("gb|rail", "n", "")];
    expect(docToLabel(doc)).toEqual(["Euston ", { icon: "gb|rail" }]);
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

  it("keeps a logo after a break as its own run", () => {
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
    expect(docToLabel(doc)).toEqual(["a", { br: true }, { icon: "gb|rail" }]);
  });
});
