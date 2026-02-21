/**
 * Natural Language Search — Hybrid Regex + LLM Parser
 *
 * Adds an LLM layer for complex multi-faceted queries like
 * "outdoor jazz near midtown this weekend under $30" that the
 * existing regex-based query-intent.ts can't decompose into
 * multiple simultaneous filters.
 *
 * Simple queries ("comedy", "live music tonight") skip the LLM
 * entirely and go through the standard keyword/regex path.
 *
 * Detection heuristic lives in nl-detect.ts (client-safe).
 * This module is server-only (imports openai, shared-cache).
 */

import OpenAI from "openai";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { CATEGORIES, SUBCATEGORIES, TAG_GROUPS } from "@/lib/search-constants";
import { NEIGHBORHOOD_NAMES, NEIGHBORHOOD_ALIASES } from "@/config/neighborhoods";
import { logger } from "@/lib/logger";
import type { SearchOptions } from "@/lib/unified-search";

// Re-export client-safe types and detection heuristic
export { isNaturalLanguageQuery, type NLSearchContext } from "@/lib/nl-detect";

// ============================================
// Types
// ============================================

export interface ParsedNLFilters {
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
}

// ============================================
// Vocabulary for LLM Prompt
// ============================================

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

const GENRE_VALUES: string[] = Object.values(SUBCATEGORIES).flatMap((subs) =>
  subs.map((s) => {
    const parts = s.value.split(".");
    return parts.length > 1 ? parts.slice(1).join(".") : s.value;
  })
);

const TAG_VALUES: string[] = [
  ...TAG_GROUPS.Vibe,
  ...TAG_GROUPS.Access,
  ...TAG_GROUPS.Type,
  ...TAG_GROUPS.Special,
  ...TAG_GROUPS.Logistics,
].map((t) => t.value);

const VIBE_VALUES = TAG_GROUPS.Vibe.map((t) => t.value);

// ============================================
// System Prompt
// ============================================

function buildSystemPrompt(): string {
  return `You are a search query parser for a local events discovery app in Atlanta, GA.

Given a natural language query, extract structured search filters. Return ONLY valid JSON matching the schema below.

VALID CATEGORIES (use these exact values):
${CATEGORY_VALUES.join(", ")}

VALID GENRES (subcategories — use these exact values):
${GENRE_VALUES.join(", ")}

VALID NEIGHBORHOODS (use these exact names):
${(NEIGHBORHOOD_NAMES as readonly string[]).join(", ")}

NEIGHBORHOOD ALIASES:
${Object.entries(NEIGHBORHOOD_ALIASES).map(([k, v]) => `${k} → ${v}`).join(", ")}

VALID TAGS:
${TAG_VALUES.join(", ")}

VALID VIBES (subset of tags):
${VIBE_VALUES.join(", ")}

VALID DATE FILTERS:
today, tonight, tomorrow, weekend, week

JSON SCHEMA:
{
  "searchTerms": "core keywords for text search (strip out filter words)",
  "categories": ["category values from the list above"],
  "genres": ["genre values from the list above"],
  "neighborhoods": ["exact neighborhood names from the list above"],
  "dateFilter": "today|tonight|tomorrow|weekend|week or null",
  "isFree": true/false or null,
  "tags": ["tag values from the list above"],
  "priceMax": number or null (e.g. 30 for "under $30"),
  "vibes": ["vibe values from the list above"],
  "explanation": "human-readable summary of what was parsed",
  "suggestedChips": ["2-4 short refinement suggestions like 'Remove: outdoor', 'Change: all neighborhoods'"]
}

RULES:
- Only use values from the lists above. Never invent new values.
- "searchTerms" should contain the core subject (e.g. "jazz" from "outdoor jazz near midtown")
- If a word maps to both a category and a genre, prefer the more specific genre
- "tonight" maps to dateFilter "tonight", "today" maps to "today"
- "this weekend" or "saturday" maps to "weekend"
- Resolve neighborhood aliases (O4W → Old Fourth Ward, EAV → East Atlanta Village, etc.)
- For price queries like "under $30", set priceMax to the number
- "free" should set isFree: true AND/OR add "free" to tags
- If the query is vague ("something fun tonight"), searchTerms can be empty
- suggestedChips should offer ways to broaden or refine the search
- Return valid JSON only, no markdown fences`;
}

// ============================================
// LLM Parse
// ============================================

const NL_CACHE_NAMESPACE = "nl-search";
const NL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LLM_TIMEOUT_MS = 2500;
const MAX_QUERY_LENGTH = 500;

/**
 * Parse a natural language query into structured filters using gpt-4o-mini.
 * Results are cached in shared cache (Redis + memory) for 5 minutes.
 */
export async function parseNaturalLanguageQuery(
  query: string
): Promise<ParsedNLFilters> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    throw new Error("Query too long for NL parsing");
  }

  const normalizedQuery = trimmedQuery.toLowerCase();
  const cacheKey = normalizedQuery.replace(/\s+/g, " ");

  return getOrSetSharedCacheJson<ParsedNLFilters>(
    NL_CACHE_NAMESPACE,
    cacheKey,
    NL_CACHE_TTL_MS,
    () => callLLMParse(trimmedQuery)
  );
}

async function callLLMParse(query: string): Promise<ParsedNLFilters> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = new OpenAI({ apiKey });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_tokens: 500,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: query },
        ],
      },
      { signal: controller.signal }
    );

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(raw) as ParsedNLFilters;

    return sanitizeParsedFilters(parsed);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ensure LLM output only contains valid values from our vocabularies.
 */
function sanitizeParsedFilters(parsed: ParsedNLFilters): ParsedNLFilters {
  const result: ParsedNLFilters = {
    searchTerms: typeof parsed.searchTerms === "string" ? parsed.searchTerms.trim() : "",
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    suggestedChips: Array.isArray(parsed.suggestedChips)
      ? parsed.suggestedChips.filter((c): c is string => typeof c === "string").slice(0, 4)
      : [],
  };

  if (Array.isArray(parsed.categories)) {
    const valid = parsed.categories.filter((c) => (CATEGORY_VALUES as string[]).includes(c));
    if (valid.length > 0) result.categories = valid;
  }

  if (Array.isArray(parsed.genres)) {
    const valid = parsed.genres.filter((g) => GENRE_VALUES.includes(g));
    if (valid.length > 0) result.genres = valid;
  }

  if (Array.isArray(parsed.neighborhoods)) {
    const valid = parsed.neighborhoods.filter((n) =>
      (NEIGHBORHOOD_NAMES as readonly string[]).includes(n)
    );
    if (valid.length > 0) result.neighborhoods = valid;
  }

  if (
    typeof parsed.dateFilter === "string" &&
    ["today", "tonight", "tomorrow", "weekend", "week"].includes(parsed.dateFilter)
  ) {
    result.dateFilter = parsed.dateFilter as ParsedNLFilters["dateFilter"];
  }

  if (typeof parsed.isFree === "boolean") {
    result.isFree = parsed.isFree;
  }

  if (Array.isArray(parsed.tags)) {
    const valid = parsed.tags.filter((t) => TAG_VALUES.includes(t));
    if (valid.length > 0) result.tags = valid;
  }

  if (typeof parsed.priceMax === "number" && parsed.priceMax > 0) {
    result.priceMax = parsed.priceMax;
  }

  if (Array.isArray(parsed.vibes)) {
    const valid = parsed.vibes.filter((v) => (VIBE_VALUES as string[]).includes(v));
    if (valid.length > 0) result.vibes = valid;
  }

  return result;
}

// ============================================
// Convert to SearchOptions
// ============================================

/**
 * Map ParsedNLFilters to the existing SearchOptions interface
 * used by unifiedSearch(). This bridges the LLM output to the
 * existing search infrastructure.
 *
 * Note: priceMax is preserved in ParsedNLFilters for the explanation/UI
 * but is not mapped to SearchOptions (which lacks a priceMax field).
 * Price filtering would require a unifiedSearch() enhancement.
 * For now, priceMax is surfaced in the NL context explanation so users
 * understand what was parsed, even if the DB filter isn't applied yet.
 */
export function convertToSearchOptions(
  parsed: ParsedNLFilters,
  opts?: { portalId?: string; types?: SearchOptions["types"] }
): SearchOptions {
  // Merge vibes into tags since the search engine treats them the same
  const allTags = [...(parsed.tags || []), ...(parsed.vibes || [])];
  const uniqueTags = [...new Set(allTags)];

  const options: SearchOptions = {
    query: parsed.searchTerms || "",
    useIntentAnalysis: true,
    boostExactMatches: true,
    includeFacets: true,
    includeSocialProof: true,
  };

  if (parsed.categories?.length) options.categories = parsed.categories;
  if (parsed.genres?.length) options.genres = parsed.genres;
  if (parsed.neighborhoods?.length) options.neighborhoods = parsed.neighborhoods;
  if (parsed.dateFilter) options.dateFilter = parsed.dateFilter;
  if (parsed.isFree) options.isFree = true;
  if (uniqueTags.length > 0) options.tags = uniqueTags;
  if (opts?.portalId) options.portalId = opts.portalId;
  if (opts?.types?.length) options.types = opts.types;

  // For very open-ended queries with no search terms but filters,
  // ensure we still get results by setting a reasonable limit
  if (!options.query && (options.categories || options.dateFilter || options.tags)) {
    options.limit = 20;
  }

  return options;
}
