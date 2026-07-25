import type { ReactElement, ReactNode } from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render, type RenderResult } from "@testing-library/react";

// Chakra components need a system in context. Tests use the default system
// (the app layers a `card` recipe on top, but nothing under test depends on it).
function Wrapper({ children }: { children: ReactNode }): ReactElement {
  return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
}

/** `render` from testing-library, wrapped in a ChakraProvider. */
export function renderWithChakra(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: Wrapper });
}
