"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { Box, Button, Flex, Heading, HStack, Splitter } from "@chakra-ui/react";
import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { RouteMap, type RouteDiagram } from "@repo/routemap";

const STORAGE_KEY = "routemap-editor:config";
const SIZE_KEY = "routemap-editor:size";
const DEFAULT_SIZE = [60, 40]; // editor gets the majority; preview is a narrow strip

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

/** Catches render throws from a malformed-but-valid diagram so the editor survives. */
class PreviewBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Box bg="red.subtle" color="red.fg" p="3" fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap">
          Render error: {this.state.error.message}
        </Box>
      );
    }
    return this.props.children;
  }
}

export default function EditorPage() {
  const [text, setText] = useState(SAMPLE);
  const [size, setSize] = useState<number[]>(DEFAULT_SIZE);
  // Load persisted config + panel size after mount (no SSR/hydration mismatch);
  // `hydrated` gates the saves so the initial mount can't overwrite storage.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedText = localStorage.getItem(STORAGE_KEY);
    if (savedText != null) setText(savedText);
    const savedSize = localStorage.getItem(SIZE_KEY);
    if (savedSize) {
      try {
        const parsedSize = JSON.parse(savedSize);
        if (Array.isArray(parsedSize) && parsedSize.length === 2) setSize(parsedSize);
      } catch {
        // ignore malformed stored size
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, text);
  }, [text, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  }, [size, hydrated]);

  const parsed = useMemo<{ diagram: RouteDiagram | null; error: string | null }>(() => {
    try {
      return { diagram: JSON.parse(text) as RouteDiagram, error: null };
    } catch (e) {
      return { diagram: null, error: (e as Error).message };
    }
  }, [text]);

  // JSON syntax highlighting + inline parse-error markers (gutter + squiggles).
  const extensions = useMemo(() => [json(), lintGutter(), linter(jsonParseLinter())], []);

  const format = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      // invalid JSON: nothing to format
    }
  };

  return (
    <Splitter.Root
      height="100dvh"
      width="100%"
      panels={[
        { id: "editor", minSize: 20 },
        { id: "preview", minSize: 20 },
      ]}
      size={size}
      onResize={(details) => setSize(details.size)}
    >
      <Splitter.Panel id="editor" p="0" height="100%">
        <Flex direction="column" height="100%" minW="0" width="100%">
          <Flex align="center" justify="space-between" px="3" py="2" borderBottomWidth="1px" borderColor="border">
            <Heading size="sm">RouteMap config (grid-JSON)</Heading>
            <HStack gap="2">
              <Button size="xs" variant="outline" onClick={format} disabled={parsed.error != null}>
                Format
              </Button>
              <Button size="xs" variant="outline" onClick={() => setText(SAMPLE)}>
                Reset to sample
              </Button>
            </HStack>
          </Flex>
          <Box flex="1" minH="0" overflow="hidden">
            <CodeMirror
              value={text}
              onChange={setText}
              extensions={extensions}
              height="100%"
              style={{ height: "100%", fontSize: 13 }}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
            />
          </Box>
        </Flex>
      </Splitter.Panel>

      <Splitter.ResizeTrigger id="editor:preview" />

      <Splitter.Panel id="preview" overflow="auto" p="6" height="100%">
        {parsed.diagram ? (
          <PreviewBoundary key={text}>
            <RouteMap diagram={parsed.diagram} />
          </PreviewBoundary>
        ) : null}
      </Splitter.Panel>
    </Splitter.Root>
  );
}
