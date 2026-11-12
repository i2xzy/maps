import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Node env for the pure-function suites (map helpers and the import domain core).
// The @supabase alias mirrors tsconfig paths so lib/import can read the
// generated enum/types the same way the app does.
export default defineConfig({
  resolve: {
    alias: {
      '@supabase': fileURLToPath(new URL('../../packages/supabase/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
