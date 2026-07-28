"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A local text buffer for an input whose value is DERIVED from the document.
 *
 * Every edit round-trips through the model (model → formatJson → parse), which re-creates
 * the value on each keystroke; driving an input straight off that jitters the cursor. This
 * keeps typing instant and only re-syncs when the external value changes from something
 * other than our own last edit — a direct JSON edit, or switching diagrams.
 *
 * Used by the label and colspan inputs, and by the wikitext pane, which needs it most: the
 * pane's value is the serialized diagram, so without a buffer every keystroke would rewrite
 * the text under the caret.
 */
export function useTextBuffer(
  external: string,
  commit: (v: string) => void,
): [string, (v: string) => void] {
  const [local, setLocal] = useState(external);
  const lastExternal = useRef(external);
  useEffect(() => {
    if (external !== lastExternal.current) {
      lastExternal.current = external;
      setLocal(external);
    }
  }, [external]);
  const onChange = (v: string): void => {
    lastExternal.current = v; // our own change — don't let the sync effect clobber it
    setLocal(v);
    commit(v);
  };
  return [local, onChange];
}
