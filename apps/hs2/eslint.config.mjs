import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  // The import domain core is reachable only through its barrel (lib/import).
  // Deep imports of its internals from outside the folder are a lint error.
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/import/*'],
              message: 'Import from @/lib/import (its barrel), not its internals.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
