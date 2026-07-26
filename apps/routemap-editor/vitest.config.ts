import { defineConfig } from "vitest/config";

// Mirrors the package config, but with a jsdom environment + a setup file for
// the browser APIs Chakra/Ark rely on (ResizeObserver, matchMedia, …) so the
// visual editor's client components can be rendered and driven in tests.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
    // The picker tests render the whole logo catalog — ~1,300 Ark components — because
    // the IntersectionObserver stub reports everything as on screen. That's seconds in
    // jsdom, and more when the files run in parallel, so the 5s default trips on a
    // busy machine rather than on a real failure.
    testTimeout: 20_000,
  },
});
