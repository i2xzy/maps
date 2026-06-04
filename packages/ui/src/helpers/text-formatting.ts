// Helper function to format snake_case to Title Case
export function snakeCaseToTitleCase(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatChainage(chainage: number): string {
  const kilometers = Math.floor(chainage / 1000);
  const meters = chainage % 1000;
  return `${kilometers}+${String(meters).padStart(3, '0')}`;
}

/**
 * Initials for an avatar fallback, e.g. "Birds Eye View" -> "BV".
 *
 * Computed here (rather than letting Chakra's Avatar.Fallback derive them) so
 * names containing emoji/symbols don't get sliced mid-codepoint. Chakra slices
 * by UTF-16 unit, which splits an emoji's surrogate pair and produces a broken
 * half-character that the server and client serialize differently — a
 * hydration mismatch. We strip non-letters first and use Array.from so
 * multi-byte characters are never split.
 */
export function getInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstChar = (word: string | undefined) =>
    word ? (Array.from(word)[0] ?? '') : '';
  const first = firstChar(words[0]);
  const last = words.length > 1 ? firstChar(words[words.length - 1]) : '';
  return (first + last).toUpperCase();
}
