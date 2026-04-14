const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const MULTI_SPACE = /\s+/g;

/**
 * Normalize a user-supplied search query.
 *
 * - NFKC unicode canonicalization (fullwidth → ASCII, etc.)
 * - Strip control chars and zero-width (homograph + evasion defense)
 * - Collapse whitespace
 * - Hard-clamp to 120 chars after normalization (NFKC can expand length)
 *
 * This function is pure and sync. It is called from three places:
 *   1. lib/search/input-schema.ts (parseSearchInput) — user input → normalized
 *   2. lib/search/understanding/annotate.ts — feeds tokenize()
 *   3. lib/search/observability.ts — hash the normalized form, never raw
 */
export function normalizeSearchQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(CONTROL_CHARS, " ")
    .replace(ZERO_WIDTH, "")
    .replace(MULTI_SPACE, " ")
    .trim()
    .slice(0, 120);
}
