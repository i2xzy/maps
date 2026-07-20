"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { Box, Button, Flex, Heading, Splitter, Textarea } from "@chakra-ui/react";
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
  // Load persisted config after mount (no SSR/hydration mismatch); `hydrated`
  // gates the save so the initial mount can't overwrite storage with SAMPLE.
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
    <Splitter.Root
      height="100dvh"
      width="100%"
      panels={[
        { id: "editor", minSize: 20 },
        { id: "preview", minSize: 20 },
      ]}
      defaultSize={[38, 62]}
    >
      <Splitter.Panel id="editor" p="0" height="100%">
        <Flex direction="column" height="100%" minW="0" width="100%">
          <Flex align="center" justify="space-between" px="3" py="2" borderBottomWidth="1px" borderColor="border">
            <Heading size="sm">RouteMap config (grid-JSON)</Heading>
            <Button size="xs" variant="outline" onClick={() => setText(SAMPLE)}>
              Reset to sample
            </Button>
          </Flex>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            aria-label="grid-JSON config"
            flex="1"
            resize="none"
            border="0"
            borderRadius="0"
            fontFamily="mono"
            fontSize="sm"
            _focusVisible={{ outline: "none", boxShadow: "none" }}
          />
          {parsed.error ? (
            <Box bg="red.subtle" color="red.fg" px="3" py="2" fontFamily="mono" fontSize="xs">
              Invalid JSON: {parsed.error}
            </Box>
          ) : null}
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
