// The only public surface of the import core. Everything else in this folder is
// internal; the eslint `no-restricted-imports` rule bans `@/lib/import/*` deep
// imports from outside, so callers reach the domain only through here.

export { parseLayer } from './kml/parse';
export { resolveLayer } from './resolve';
export { DecisionSchema, decisionRef, foldDecisions } from './decisions';
export type { Decision, DecisionRef } from './decisions';
export * from './types';
