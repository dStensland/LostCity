/**
 * Natural Language Query Detection Heuristic
 *
 * Pure client-safe module — no server dependencies.
 * Separated from nl-search.ts so "use client" components can
 * import it without pulling in openai/redis.
 */

export interface NLSearchContext {
  explanation: string;
  chips: string[];
  parsedFilters: {
    searchTerms: string;
    categories?: string[];
    genres?: string[];
    neighborhoods?: string[];
    dateFilter?: "today" | "tonight" | "tomorrow" | "weekend" | "week";
    isFree?: boolean;
    tags?: string[];
    priceMax?: number;
    vibes?: string[];
    explanation: string;
    suggestedChips?: string[];
  };
  fallback?: boolean;
}

const NL_PREPOSITIONS = /\b(near|in|around|at|for|under|with|without|between|during)\b/i;
const NL_CONVERSATIONAL = /\b(something|anything|what's|where can|where's|show me|find me|looking for|i want|i need|recommend|suggest)\b/i;
const NL_CONJUNCTIONS = /\b(and|but|or)\b/i;
const NL_PRICE_PATTERN = /\b(under|less than|cheaper than|below)\s*\$?\d+/i;
const NL_COMPLEX_TIME = /\b(this|next|coming)\s+(weekend|week|friday|saturday|sunday|month)/i;

/**
 * Heuristic to detect whether a query is "natural language" enough
 * to warrant an LLM parse. Returns false for simple keyword queries
 * that the existing regex intent system handles fine.
 *
 * Scoring:
 * - Conversational phrasing ("something", "show me"): +2
 * - Price constraints ("under $30"): +2
 * - Prepositions ("near", "in", "for"): +1
 * - Conjunctions ("and", "or"): +1
 * - Complex time references ("this weekend"): +1
 * - 5+ words: +1
 *
 * Needs ≥2 signals to trigger.
 */
export function isNaturalLanguageQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 8) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 3) return false;

  let signals = 0;

  if (NL_CONVERSATIONAL.test(trimmed)) signals += 2;
  if (NL_PREPOSITIONS.test(trimmed)) signals += 1;
  if (NL_CONJUNCTIONS.test(trimmed)) signals += 1;
  if (NL_PRICE_PATTERN.test(trimmed)) signals += 2;
  if (NL_COMPLEX_TIME.test(trimmed)) signals += 1;
  if (words.length >= 5) signals += 1;

  return signals >= 2;
}
