import { defineConfig } from 'vitest/config';

// Minimal config: the only suite today is the pure-function helper
// rowsToFeatureCollection. No DOM/browser env needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
