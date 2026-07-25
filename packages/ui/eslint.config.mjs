import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // Vendored Chakra CLI snippets (`chakra snippet add …`) — kept close to
    // upstream so they can be re-pulled; relax two rules they trip.
    files: [
      "src/components/rich-text-editor-control.tsx",
      "src/components/rich-text-editor.tsx",
      "src/components/color-mode.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
