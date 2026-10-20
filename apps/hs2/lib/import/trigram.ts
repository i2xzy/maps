// pg_trgm-compatible trigram similarity. Advisory only (the 0.45 typo
// threshold suggests a fix; it never decides a link). Ported to TS so the
// heuristic needs no DB round-trip and no second normalisation rule.

export const TYPO_THRESHOLD = 0.45;

/** pg_trgm trigrams: split into alphanumeric words, pad each "  word ", slide 3. */
function trigrams(s: string): Set<string> {
  const result = new Set<string>();
  for (const word of s.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) result.add(padded.slice(i, i + 3));
  }
  return result;
}

/** Jaccard over trigram sets: |A ∩ B| / |A ∪ B|. 0 when both are empty. */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
