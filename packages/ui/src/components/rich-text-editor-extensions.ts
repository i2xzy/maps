"use client";

/**
 * A ready-to-use TipTap extension set for the RichTextEditor. Importing these
 * packages here also loads their command type augmentations (`toggleBold`,
 * `setLink`, `setColor`, …) so `rich-text-editor-control.tsx` type-checks on its
 * own. Consumers pass `richTextExtensions` (or a subset) to `useEditor`.
 *
 * StarterKit already bundles Link and Underline, so they're not listed again.
 */
import { StarterKit } from "@tiptap/starter-kit";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import type { Extensions } from "@tiptap/react";

export const richTextExtensions: Extensions = [
  StarterKit,
  TextStyle,
  FontFamily,
  FontSize,
  Color,
  Subscript,
  Superscript,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: true }),
];
