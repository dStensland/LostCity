/**
 * Search Suggestions Library
 *
 * Provides fast autocomplete suggestions using the search_suggestions
 * materialized view with pg_trgm fuzzy matching for typo tolerance.
 */

import { createServiceClient } from "./supabase/service";

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
  limit = 8
): Promise<SearchSuggestion[]> {
  const trimmed = prefix.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("get_similar_suggestions", {
    p_query: trimmed,
    p_limit: limit,
    p_min_similarity: 0.2,
  });

  if (error) {
    console.error("Error getting search suggestions:", error);
    return [];
  }

  const rows = (data as SuggestionRow[]) || [];

  return rows.map((row) => ({
    text: row.suggestion,
    type: mapSuggestionType(row.type),
    frequency: row.frequency,
    similarity: row.similarity_score,
  }));
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
  limit = 3
): Promise<SuggestionWithCorrection[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3) {
    return [];
  }

  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("get_spelling_suggestions", {
    p_query: trimmed,
    p_limit: limit,
  });

  if (error) {
    console.error("Error getting typo corrections:", error);
    return [];
  }

  const rows = (data as SpellingSuggestionRow[]) || [];

  return rows.map((row) => ({
    suggestion: row.suggestion,
    similarity: row.similarity_score,
  }));
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
  limits: Partial<Record<SearchSuggestion["type"], number>> = {}
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
  const allSuggestions = await getSearchSuggestions(prefix, 30);

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
  correctionLimit = 3
): Promise<{
  suggestions: SearchSuggestion[];
  corrections: SuggestionWithCorrection[];
}> {
  const [suggestions, corrections] = await Promise.all([
    getSearchSuggestions(query, suggestionLimit),
    getTypoCorrectedSuggestions(query, correctionLimit),
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
