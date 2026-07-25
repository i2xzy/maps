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
  },
});
