"use client";

import { useMemo, useState } from "react";
import { RouteMap, type RouteDiagram } from "@repo/routemap";

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

export default function EditorPage() {
  const [text, setText] = useState(SAMPLE);

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
        <header style={{ padding: "10px 14px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
          RouteMap config (grid-JSON)
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
        {parsed.error ? (
          <div style={{ padding: "8px 14px", background: "#fdecea", color: "#b3261e", font: "12px/1.4 monospace" }}>
            {parsed.error}
          </div>
        ) : null}
      </section>
      <section style={{ overflow: "auto", padding: 24 }}>
        {parsed.diagram ? <RouteMap diagram={parsed.diagram} /> : null}
      </section>
    </main>
  );
}
