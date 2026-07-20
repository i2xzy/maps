"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { RouteMap, type RouteDiagram } from "@repo/routemap";

const STORAGE_KEY = "routemap-editor:config";

const SAMPLE = `{
  "rows": [
    { "left": "to WCML (north)", "cells": ["STR"] },
    { "left": "Delta Junction", "cells": ["ABZrg", "STRc3"] },
    { "cells": ["STR", "STR"] },
    { "cells": ["vSTR", "exSTR"] },
    { "left": "Bromford Tunnel", "cells": [{ "code": "hKRZW", "title": "bridge over water" }] },
    { "type": "colspan", "text": "@repo/routemap live editor" }
  ]
}`;

const errorBox: React.CSSProperties = {
  padding: "8px 14px",
  background: "#fdecea",
  color: "#b3261e",
  font: "12px/1.4 ui-monospace, monospace",
  whiteSpace: "pre-wrap",
};

/** Catches render throws from a malformed-but-valid diagram so the editor survives. */
class PreviewBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div style={errorBox}>Render error: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

export default function EditorPage() {
  const [text, setText] = useState(SAMPLE);
  // Load persisted config after mount (avoids SSR/hydration mismatch), then
  // persist on every change. `hydrated` gates the save so the initial mount
  // doesn't overwrite storage with SAMPLE before the load runs.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved != null) setText(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, text);
  }, [text, hydrated]);

  const parsed = useMemo<{ diagram: RouteDiagram | null; error: string | null }>(() => {
    try {
      return { diagram: JSON.parse(text) as RouteDiagram, error: null };
    } catch (e) {
      return { diagram: null, error: (e as Error).message };
    }
  }, [text]);

  return (
    <main style={{ display: "grid", gridTemplateColumns: "minmax(320px, 38%) 1fr", height: "100vh" }}>
      <section style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #ddd", minWidth: 0 }}>
        <header style={{ padding: "10px 14px", borderBottom: "1px solid #eee", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>RouteMap config (grid-JSON)</span>
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            style={{ font: "12px system-ui", cursor: "pointer", padding: "2px 8px" }}
          >
            Reset to sample
          </button>
        </header>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label="grid-JSON config"
          style={{
            flex: 1,
            border: 0,
            padding: 14,
            font: "13px/1.5 ui-monospace, SFMono-Regular, monospace",
            resize: "none",
            outline: "none",
          }}
        />
        {parsed.error ? <div style={errorBox}>Invalid JSON: {parsed.error}</div> : null}
      </section>
      <section style={{ overflow: "auto", padding: 24 }}>
        {parsed.diagram ? (
          <PreviewBoundary key={text}>
            <RouteMap diagram={parsed.diagram} />
          </PreviewBoundary>
        ) : null}
      </section>
    </main>
  );
}
