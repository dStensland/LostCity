import type { IntentType, Token } from "@/lib/search/understanding/types";

const VENUE_KEYWORDS = new Set([
  "shops", "shop", "restaurants", "restaurant", "bars", "bar", "cafes", "cafe",
  "venues", "venue", "places", "place", "spots", "spot",
]);

const BARE_CATEGORIES = new Set([
  "comedy", "music", "food", "art", "theater", "theatre", "film",
  "nightlife", "sports", "family", "community", "fitness",
]);

/**
 * Rule-based intent classifier. Pure sync function.
 *
 * CRITICAL INVARIANT: this classifier never mutates or substitutes the raw
 * query. It ONLY returns an intent tag + confidence. The caller (annotate)
 * attaches the intent to the immutable AnnotatedQuery alongside the raw
 * string — retrievers then receive both.
 *
 * This is the architectural fix for the 1869-line unified-search.ts bug
 * where "jazz" was silently replaced with category=music + empty FTS query.
 * Classification happens; substitution does not.
 */
export function classifyIntent(
  raw: string,
  tokens: Token[]
): { type: IntentType; confidence: number } {
  const trimmed = raw.trim();
  if (!trimmed || tokens.length === 0) {
    return { type: "unknown", confidence: 0 };
  }

  // Bare single-token category name → browse
  if (tokens.length === 1 && BARE_CATEGORIES.has(tokens[0].normalized)) {
    return { type: "browse_category", confidence: 0.85 };
  }

  // Any venue-ish keyword in tokens → find_venue
  const hasVenueKeyword = tokens.some(t => VENUE_KEYWORDS.has(t.normalized));
  if (hasVenueKeyword) {
    return { type: "find_venue", confidence: 0.8 };
  }

  // Default: find_event (the most common search intent)
  return { type: "find_event", confidence: 0.7 };
}
