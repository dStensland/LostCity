import type { Token } from "@/lib/search/understanding/types";

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "have", "he", "in", "is", "it", "its", "of", "on", "or",
  "that", "the", "to", "was", "were", "will", "with", "this", "near",
]);

function unaccent(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Tokenize a normalized query string. Pure sync function.
 * Returns tokens with positional offsets (for highlight + entity spans)
 * and a stopword flag (used by intent classification).
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  if (!input) return tokens;

  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const text = match[0];
    const normalized = unaccent(text.toLowerCase());
    tokens.push({
      text,
      normalized,
      start: match.index,
      end: match.index + text.length,
      stop: STOPWORDS.has(normalized),
    });
  }
  return tokens;
}
