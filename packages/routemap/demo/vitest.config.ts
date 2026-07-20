import { defineConfig } from "vitest/config";

// One-off config so the demo generator (outside src/) can be run explicitly:
//   pnpm exec vitest run --config demo/vitest.config.ts
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["demo/gen.test.tsx"],
  },
});
