/**
 * Search Suggestions Library
 *
 * Provides fast autocomplete suggestions using the search_suggestions
 * materialized view with pg_trgm fuzzy matching for typo tolerance.
 */

import { createServiceClient } from "./supabase/service";
import { getSharedCacheJson, setSharedCacheJson } from "./shared-cache";

const SEARCH_SUGGESTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_SUGGESTIONS_CACHE_MAX_ENTRIES = 300;
const SEARCH_SUGGESTIONS_CACHE_NAMESPACE = "search-suggestions";
const SPELLING_SUGGESTIONS_CACHE_NAMESPACE = "search-spelling-suggestions";
const SUGGESTION_FALLBACK_STOP_WORDS = new Set([
  "and",
  "at",
  "bar",
  "club",
  "event",
  "events",
  "for",
  "in",
  "live",
  "music",
  "night",
  "nights",
  "party",
  "show",
  "shows",
  "the",
  "with",
]);
const searchSuggestionsMemoryCache = new Map<
  string,
  { expiresAt: number; value: SearchSuggestion[] }
>();
const spellingSuggestionsMemoryCache = new Map<
  string,
  { expiresAt: number; value: SuggestionWithCorrection[] }
>();
const searchSuggestionsInFlight = new Map<
  string,
  Promise<SearchSuggestion[]>
>();
const spellingSuggestionsInFlight = new Map<
  string,
  Promise<SuggestionWithCorrection[]>
>();

// ============================================
// Types
// ============================================

export interface SearchSuggestion {
  text: string;
  type: "event" | "venue" | "neighborhood" | "organizer" | "category" | "tag" | "vibe" | "festival";
  frequency: number;
  similarity?: number;
}

export interface SuggestionWithCorrection {
  suggestion: string;
  similarity: number;
}

interface SuggestionRow {
  suggestion: string;
  type: string;
  frequency: number;
  similarity_score: number;
}

interface SpellingSuggestionRow {
  suggestion: string;
  type: string;
  similarity_score: number;
}

function normalizeSuggestionQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractSuggestionFallbackToken(value: string): string | null {
  const normalized = normalizeSuggestionQuery(value);
  if (!/\s/.test(normalized)) {
    return null;
  }

  const tokens = normalized
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9+&-]/g, ""))
    .filter(
      (token) => token.length >= 4 && !SUGGESTION_FALLBACK_STOP_WORDS.has(token),
    )
    .sort((left, right) => right.length - left.length);

  return tokens[0] || null;
}

function buildSuggestionCacheKey(
  prefix: string,
  limit: number,
  city?: string,
): string {
  return JSON.stringify({
    q: normalizeSuggestionQuery(prefix),
    limit,
    city: city ? normalizeSuggestionQuery(city) : null,
  });
}

function getMemoryCachedValue<T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  cacheKey: string,
): T | null {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setMemoryCachedValue<T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  cacheKey: string,
  value: T,
): void {
  cache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_SUGGESTIONS_CACHE_TTL_MS,
    value,
  });

  if (cache.size > SEARCH_SUGGESTIONS_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

// ============================================
// Main Functions
// ============================================

/**
 * Get fast autocomplete suggestions from the materialized view.
 * Uses prefix matching and trigram similarity for fuzzy matching.
 *
 * @param prefix - The search prefix to match
 * @param limit - Maximum number of suggestions to return (default: 8)
 * @returns Array of matching suggestions with type and frequency
 */
export async function getSearchSuggestions(
  prefix: string,
  limit = 8,
  city?: string
): Promise<SearchSuggestion[]> {
  const trimmed = normalizeSuggestionQuery(prefix);
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const cacheKey = buildSuggestionCacheKey(trimmed, limit, city);
  const memoryCached = getMemoryCachedValue(searchSuggestionsMemoryCache, cacheKey);
  if (memoryCached) {
    return memoryCached;
  }
  const cached = await getSharedCacheJson<SearchSuggestion[]>(
    SEARCH_SUGGESTIONS_CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    setMemoryCachedValue(searchSuggestionsMemoryCache, cacheKey, cached);
    return cached;
  }

  const inFlight = searchSuggestionsInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const client = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.rpc as any)("get_similar_suggestions", {
      p_query: trimmed,
      p_limit: limit,
      p_min_similarity: 0.2,
      p_city: city || null,
    });

    if (error) {
      console.error("Error getting search suggestions:", error);
      return [];
    }

    const rows = (data as SuggestionRow[]) || [];
    const suggestions = rows.map((row) => ({
      text: row.suggestion,
      type: mapSuggestionType(row.type),
      frequency: row.frequency,
      similarity: row.similarity_score,
    }));

    await setSharedCacheJson(
      SEARCH_SUGGESTIONS_CACHE_NAMESPACE,
      cacheKey,
      suggestions,
      SEARCH_SUGGESTIONS_CACHE_TTL_MS,
      { maxEntries: SEARCH_SUGGESTIONS_CACHE_MAX_ENTRIES },
    );
    setMemoryCachedValue(searchSuggestionsMemoryCache, cacheKey, suggestions);
    return suggestions;
  })();

  searchSuggestionsInFlight.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    const current = searchSuggestionsInFlight.get(cacheKey);
    if (current === loadPromise) {
      searchSuggestionsInFlight.delete(cacheKey);
    }
  }
}

export async function getSearchSuggestionsWithFallback(
  query: string,
  limit = 8,
  city?: string,
): Promise<SearchSuggestion[]> {
  const directSuggestions = await getSearchSuggestions(query, limit, city);
  if (directSuggestions.length > 0) {
    return directSuggestions;
  }

  const fallbackToken = extractSuggestionFallbackToken(query);
  if (!fallbackToken) {
    return directSuggestions;
  }

  return getSearchSuggestions(fallbackToken, limit, city);
}

/**
 * Get typo-corrected suggestions for likely misspellings.
 * Returns suggestions only when the query doesn't exactly match anything.
 *
 * @param query - The potentially misspelled query
 * @param limit - Maximum number of corrections to return (default: 3)
 * @returns Array of spelling correction suggestions
 */
export async function getTypoCorrectedSuggestions(
  query: string,
  limit = 3,
  city?: string
): Promise<SuggestionWithCorrection[]> {
  const trimmed = normalizeSuggestionQuery(query);
  if (!trimmed || trimmed.length < 3) {
    return [];
  }

  const cacheKey = buildSuggestionCacheKey(trimmed, limit, city);
  const memoryCached = getMemoryCachedValue(spellingSuggestionsMemoryCache, cacheKey);
  if (memoryCached) {
    return memoryCached;
  }
  const cached = await getSharedCacheJson<SuggestionWithCorrection[]>(
    SPELLING_SUGGESTIONS_CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    setMemoryCachedValue(spellingSuggestionsMemoryCache, cacheKey, cached);
    return cached;
  }

  const inFlight = spellingSuggestionsInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const client = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.rpc as any)("get_spelling_suggestions", {
      p_query: trimmed,
      p_limit: limit,
      p_city: city || null,
    });

    if (error) {
      console.error("Error getting typo corrections:", error);
      return [];
    }

    const rows = (data as SpellingSuggestionRow[]) || [];
    const suggestions = rows.map((row) => ({
      suggestion: row.suggestion,
      similarity: row.similarity_score,
    }));

    await setSharedCacheJson(
      SPELLING_SUGGESTIONS_CACHE_NAMESPACE,
      cacheKey,
      suggestions,
      SEARCH_SUGGESTIONS_CACHE_TTL_MS,
      { maxEntries: SEARCH_SUGGESTIONS_CACHE_MAX_ENTRIES },
    );
    setMemoryCachedValue(spellingSuggestionsMemoryCache, cacheKey, suggestions);
    return suggestions;
  })();

  spellingSuggestionsInFlight.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    const current = spellingSuggestionsInFlight.get(cacheKey);
    if (current === loadPromise) {
      spellingSuggestionsInFlight.delete(cacheKey);
    }
  }
}

/**
 * Get suggestions grouped by type for a richer autocomplete UI.
 *
 * @param prefix - The search prefix to match
 * @param limits - Limits per type (default: 3 per type)
 * @returns Suggestions organized by type
 */
export async function getGroupedSuggestions(
  prefix: string,
  limits: Partial<Record<SearchSuggestion["type"], number>> = {},
  city?: string
): Promise<{
  events: SearchSuggestion[];
  venues: SearchSuggestion[];
  neighborhoods: SearchSuggestion[];
  organizers: SearchSuggestion[];
  categories: SearchSuggestion[];
  tags: SearchSuggestion[];
  vibes: SearchSuggestion[];
}> {
  // Get more suggestions and group them
  const allSuggestions = await getSearchSuggestions(prefix, 30, city);

  const defaultLimit = 3;
  const result = {
    events: [] as SearchSuggestion[],
    venues: [] as SearchSuggestion[],
    neighborhoods: [] as SearchSuggestion[],
    organizers: [] as SearchSuggestion[],
    categories: [] as SearchSuggestion[],
    tags: [] as SearchSuggestion[],
    vibes: [] as SearchSuggestion[],
    festivals: [] as SearchSuggestion[],
  };

  const typeLimits: Record<SearchSuggestion["type"], number> = {
    event: limits.event ?? defaultLimit,
    venue: limits.venue ?? defaultLimit,
    neighborhood: limits.neighborhood ?? defaultLimit,
    organizer: limits.organizer ?? defaultLimit,
    category: limits.category ?? defaultLimit,
    tag: limits.tag ?? defaultLimit,
    vibe: limits.vibe ?? defaultLimit,
    festival: limits.festival ?? defaultLimit,
  };

  for (const suggestion of allSuggestions) {
    // Map singular type to plural result key
    const typeToKeyMap: Record<SearchSuggestion["type"], keyof typeof result> = {
      event: "events",
      venue: "venues",
      neighborhood: "neighborhoods",
      organizer: "organizers",
      category: "categories",
      tag: "tags",
      vibe: "vibes",
      festival: "festivals",
    };

    const resultKey = typeToKeyMap[suggestion.type];
    const limit = typeLimits[suggestion.type];
    if (result[resultKey].length < limit) {
      result[resultKey].push(suggestion);
    }
  }

  return result;
}

/**
 * Get combined suggestions and typo corrections for a search query.
 * This is useful for showing both autocomplete and "Did you mean?" together.
 *
 * @param query - The search query
 * @param suggestionLimit - Max suggestions to return
 * @param correctionLimit - Max corrections to return
 */
export async function getSuggestionsWithCorrections(
  query: string,
  suggestionLimit = 8,
  correctionLimit = 3,
  city?: string
): Promise<{
  suggestions: SearchSuggestion[];
  corrections: SuggestionWithCorrection[];
}> {
  const [suggestions, corrections] = await Promise.all([
    getSearchSuggestions(query, suggestionLimit, city),
    getTypoCorrectedSuggestions(query, correctionLimit, city),
  ]);

  return { suggestions, corrections };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map database type string to our typed enum.
 */
function mapSuggestionType(type: string): SearchSuggestion["type"] {
  switch (type) {
    case "event":
      return "event";
    case "venue":
      return "venue";
    case "neighborhood":
      return "neighborhood";
    case "organizer":
      return "organizer";
    case "category":
      return "category";
    case "tag":
      return "tag";
    case "vibe":
      return "vibe";
    case "festival":
      return "festival";
    default:
      return "event";
  }
}

/**
 * Get icon for suggestion type (for UI rendering).
 */
export function getSuggestionIcon(type: SearchSuggestion["type"]): string {
  switch (type) {
    case "event":
      return "calendar";
    case "venue":
      return "map-pin";
    case "neighborhood":
      return "map";
    case "organizer":
      return "users";
    case "category":
      return "folder";
    case "tag":
      return "tag";
    case "vibe":
      return "sparkles";
    case "festival":
      return "flag";
    default:
      return "search";
  }
}

/**
 * Get label for suggestion type (for UI rendering).
 */
export function getSuggestionLabel(type: SearchSuggestion["type"]): string {
  switch (type) {
    case "event":
      return "Event";
    case "venue":
      return "Venue";
    case "neighborhood":
      return "Neighborhood";
    case "organizer":
      return "Organizer";
    case "category":
      return "Category";
    case "tag":
      return "Tag";
    case "vibe":
      return "Vibe";
    case "festival":
      return "Festival";
    default:
      return "Suggestion";
  }
}
