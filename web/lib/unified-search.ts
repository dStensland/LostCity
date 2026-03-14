/**
 * Unified Search Library
 *
 * Provides full-text search across events, venues, organizers, series, and lists
 * using PostgreSQL tsvector/tsquery with pg_trgm for fuzzy matching.
 * Includes multi-factor scoring and query intent analysis for improved relevance.
 */

import { createServiceClient } from "./supabase/service";
import { analyzeQueryIntent, applyIntentBoost, extractCleanQuery, type QueryIntentResult, type SearchType } from "./query-intent";
import { fetchSocialProofCounts } from "@/lib/social-proof";

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: number | string;
  type: "event" | "venue" | "organizer" | "series" | "list" | "neighborhood" | "category" | "festival";
  title: string;
  subtitle?: string;
  href: string;
  score: number;
  metadata?: {
    date?: string;
    time?: string;
    neighborhood?: string;
    category?: string;
    isLive?: boolean;
    isFree?: boolean;
    venueType?: string;
    vibes?: string[];
    orgType?: string;
    eventCount?: number;
    followerCount?: number;
    rsvpCount?: number;
    recommendationCount?: number;
    // Series-specific
    seriesType?: string;
    nextEventDate?: string;
    // List-specific
    itemCount?: number;
    curatorName?: string;
    // Venue-specific ranking signals
    featured?: boolean;
    exploreFeatured?: boolean;
    dataQuality?: number;
    isEventVenue?: boolean;
  };
}

export interface SearchOptions {
  query: string;
  types?: ("event" | "venue" | "organizer" | "series" | "list" | "festival")[];
  limit?: number;
  offset?: number;
  categories?: string[];
  subcategories?: string[]; // DEPRECATED: converted to genres internally
  genres?: string[]; // Filter by genre values (e.g., "karaoke", "museum")
  tags?: string[]; // Filter by event tags (e.g., "outdoor", "21+")
  neighborhoods?: string[];
  dateFilter?: "today" | "tonight" | "tomorrow" | "weekend" | "week";
  isFree?: boolean;
  portalId?: string;
  city?: string; // City filter for venue search (e.g., "Atlanta")
  // Enhanced options
  useIntentAnalysis?: boolean; // Enable query intent analysis for smarter results
  boostExactMatches?: boolean; // Apply extra boost for exact title matches
  includeFacets?: boolean; // Include facet aggregation (extra DB query)
  includeDidYouMean?: boolean; // Include spelling suggestions (extra DB query)
  includeSocialProof?: boolean; // Include social proof fanout queries
  includeEventPopularitySignals?: boolean; // Include per-event social proof used in scoring
  timingRecorder?: SearchTimingRecorder;
}

export interface SearchFacet {
  type: "event" | "venue" | "organizer" | "series" | "list" | "festival";
  count: number;
}

export interface UnifiedSearchResponse {
  results: SearchResult[];
  facets: SearchFacet[];
  total: number;
  didYouMean?: string[];
}

type SearchTimingRecorder = {
  measure<T>(name: string, fn: () => Promise<T> | T, desc?: string): Promise<T>;
};

/** Convert legacy subcategory values (e.g., "nightlife.karaoke") to genre values ("karaoke") and merge with explicit genres */
function mergeSubcategoriesToGenres(subcategories?: string[], genres?: string[]): string[] | undefined {
  const merged: string[] = [...(genres || [])];
  if (subcategories?.length) {
    for (const sub of subcategories) {
      const parts = sub.split(".");
      const genreValue = parts.length > 1 ? parts.slice(1).join(".") : sub;
      if (!merged.includes(genreValue)) merged.push(genreValue);
    }
  }
  return merged.length > 0 ? merged : undefined;
}

function dedupeByTypeAndId(results: SearchResult[]): SearchResult[] {
  const byId = new Map<string, SearchResult>();

  for (const result of results) {
    const key = `${result.type}:${String(result.id)}`;
    const existing = byId.get(key);
    if (!existing || result.score > existing.score) {
      byId.set(key, result);
    }
  }

  return Array.from(byId.values());
}

// ============================================
// RPC Response Types
// ============================================

interface EventSearchRow {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  image_url: string | null;
  source_url: string;
  ticket_url: string | null;
  venue_id: number | null;
  venue_name: string | null;
  venue_neighborhood: string | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  ts_rank: number;
  similarity_score: number;
  combined_score: number;
}

interface VenueSearchRow {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  venue_types: string[] | null;
  vibes: string[] | null;
  description: string | null;
  short_description: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  website: string | null;
  ts_rank: number;
  similarity_score: number;
  combined_score: number;
  featured: boolean | null;
  explore_featured: boolean | null;
  data_quality: number | null;
  is_event_venue: boolean | null;
}

interface OrganizationSearchRow {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  categories: string[] | null;
  neighborhood: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  instagram: string | null;
  total_events_tracked: number | null;
  ts_rank: number;
  similarity_score: number;
  combined_score: number;
}

interface SeriesSearchRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  series_type: string | null;
  category: string | null;
  image_url: string | null;
  next_event_date: string | null;
  upcoming_event_count: number;
  ts_rank: number;
  similarity_score: number;
  combined_score: number;
}

interface ListSearchRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  creator_id: string;
  creator_name: string | null;
  item_count: number;
  ts_rank: number;
  similarity_score: number;
  combined_score: number;
}

interface FestivalSearchRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  announced_start: string | null;
  announced_end: string | null;
  primary_type: string | null;
  festival_type: string | null;
  ts_rank: number;
  similarity_score: number;
  combined_score: number;
}

interface FacetRow {
  entity_type: string;
  count: number;
}

interface SpellingSuggestionRow {
  suggestion: string;
  type: string;
  similarity_score: number;
}


// ============================================
// Scoring Constants
// ============================================

const SCORING = {
  EXACT_MATCH: 100, // Title exactly matches query
  STARTS_WITH: 50, // Title starts with query
  WORD_MATCH: 30, // Title contains query as complete word
  PARTIAL_MATCH: 10, // Title contains query substring
  RECENCY_MAX: 30, // Max boost for upcoming events
  POPULARITY_MAX: 20, // Max boost for popular items
  TYPE_PRIORITY: {
    // Default priority when no intent detected
    event: 5,
    venue: 4,
    festival: 4,
    organizer: 3,
    series: 2,
    list: 1,
  },
} as const;

const ENTITY_QUERY_STOP_WORDS = new Set([
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
  "show",
  "the",
  "today",
  "tonight",
  "tomorrow",
  "weekend",
]);

const PORTAL_CITY_CACHE_TTL_MS = 5 * 60 * 1000;
const portalCityCache = new Map<string, { city: string | undefined; expiresAt: number }>();

async function measureSearchTiming<T>(
  timingRecorder: SearchTimingRecorder | undefined,
  name: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!timingRecorder) {
    return await fn();
  }
  return timingRecorder.measure(name, fn);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse a search query into PostgreSQL tsquery format with prefix matching.
 * Handles multi-word queries by joining with AND operator.
 *
 * Examples:
 * - "live music" -> "live & music:*"
 * - "jazz" -> "jazz:*"
 * - "the earl" -> "the & earl:*"
 */
export function parseSearchQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";

  // Split on whitespace, filter empty strings, and join with &
  const terms = trimmed.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return "";

  // Last term gets prefix matching, others are exact
  const lastIndex = terms.length - 1;
  return terms
    .map((term, i) => (i === lastIndex ? `${term}:*` : term))
    .join(" & ");
}

/**
 * Map date filter to the format expected by the RPC function.
 */
function mapDateFilter(
  filter: "today" | "tonight" | "tomorrow" | "weekend" | "week" | undefined
): string | null {
  // Map "tonight" to "today" for the database
  if (filter === "tonight") return "today";
  return filter || null;
}

/**
 * Calculate a relevance score based on multiple factors.
 */
function calculateRelevanceScore(
  query: string,
  title: string,
  baseScore: number,
  metadata?: {
    date?: string;
    eventCount?: number;
    followerCount?: number;
    itemCount?: number;
    rsvpCount?: number;
    recommendationCount?: number;
  }
): number {
  let score = baseScore;
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();

  // Exact match bonus
  if (titleLower === queryLower) {
    score += SCORING.EXACT_MATCH;
  }
  // Starts-with bonus
  else if (titleLower.startsWith(queryLower)) {
    score += SCORING.STARTS_WITH;
  }
  // Word boundary match bonus
  else if (new RegExp(`\\b${escapeRegex(queryLower)}\\b`).test(titleLower)) {
    score += SCORING.WORD_MATCH;
  }
  // Partial match bonus
  else if (titleLower.includes(queryLower)) {
    score += SCORING.PARTIAL_MATCH;
  }

  // Recency boost removed — handled by SQL time-decay multiplier in search_events_ranked v2

  // Social proof popularity multiplier (logarithmic, uses live counts)
  const rsvpCount = metadata?.rsvpCount || 0;
  const recCount = metadata?.recommendationCount || 0;
  if (rsvpCount > 0 || recCount > 0) {
    const popularityMultiplier = 1.0
      + Math.log(rsvpCount + 1) * 0.1
      + Math.log(recCount + 1) * 0.05;
    score *= popularityMultiplier;
  }

  // Legacy popularity boost for non-event types (eventCount, followerCount, itemCount)
  if (metadata?.eventCount) {
    score += Math.min(metadata.eventCount / 5, SCORING.POPULARITY_MAX);
  }
  if (metadata?.followerCount) {
    score += Math.min(metadata.followerCount / 10, SCORING.POPULARITY_MAX);
  }
  if (metadata?.itemCount) {
    score += Math.min(metadata.itemCount / 3, SCORING.POPULARITY_MAX);
  }

  return score;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSearchText(value: string | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripLeadingArticle(value: string): string {
  return value.replace(/^(the|a|an)\s+/i, "").trim();
}

function normalizeEntityMatchText(value: string | undefined): string {
  return normalizeSearchText(stripLeadingArticle(value || ""));
}

function countMatchWords(value: string): number {
  return value
    .split(" ")
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter(Boolean).length;
}

function isAmbiguousEntityQuery(
  query: string,
  intent?: QueryIntentResult,
): boolean {
  const normalized = normalizeSearchText(query);
  if (!normalized || normalized.length < 3 || normalized.length > 32) {
    return false;
  }

  if (
    intent &&
    (intent.intent === "time" ||
      intent.intent === "category" ||
      intent.intent === "series")
  ) {
    return false;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 2) {
    return false;
  }

  if (tokens.some((token) => token.length < 3)) {
    return false;
  }

  if (tokens.every((token) => ENTITY_QUERY_STOP_WORDS.has(token))) {
    return false;
  }

  return true;
}

export function applyCommittedEntityQueryBoost(
  query: string,
  result: SearchResult,
  intent?: QueryIntentResult,
): number {
  if (!isAmbiguousEntityQuery(query, intent)) {
    return 0;
  }

  const normalizedQuery = normalizeSearchText(query);
  const normalizedTitle = normalizeSearchText(result.title);
  const normalizedComparableTitle = normalizeEntityMatchText(result.title);
  if (!normalizedTitle) {
    return 0;
  }

  const hasExactMatch =
    normalizedTitle === normalizedQuery ||
    normalizedComparableTitle === normalizedQuery;
  const hasTokenPrefixMatch =
    normalizedTitle === normalizedQuery ||
    normalizedTitle.startsWith(`${normalizedQuery} `) ||
    normalizedComparableTitle === normalizedQuery ||
    normalizedComparableTitle.startsWith(`${normalizedQuery} `);
  const hasLoosePrefixMatch =
    !hasTokenPrefixMatch &&
    (normalizedTitle.startsWith(normalizedQuery) ||
      normalizedComparableTitle.startsWith(normalizedQuery));
  const hasWordBoundaryMatch = new RegExp(
    `\\b${escapeRegex(normalizedQuery)}\\b`,
  ).test(`${normalizedTitle} ${normalizedComparableTitle}`.trim());
  const comparableTitleWordCount = countMatchWords(normalizedComparableTitle);
  const queryWordCount = normalizedQuery.split(" ").filter(Boolean).length;

  let boost = 0;

  switch (result.type) {
    case "venue":
      if (hasExactMatch) boost += 90;
      else if (hasTokenPrefixMatch) boost += 55;
      else if (hasWordBoundaryMatch) boost += 20;
      else if (hasLoosePrefixMatch) boost -= 12;

      if (queryWordCount === 1) {
        if (hasExactMatch) {
          boost += 28;
        } else if (hasTokenPrefixMatch && comparableTitleWordCount <= 3) {
          boost += 12;
        }
        if (comparableTitleWordCount >= 4) {
          boost -= 18;
        }
        if (result.metadata?.isEventVenue) boost += 12;
        if (result.metadata?.featured) {
          boost += 6;
        }
        if (result.metadata?.exploreFeatured) {
          boost += 34;
        }
        if (typeof result.metadata?.dataQuality === "number") {
          boost += Math.min(8, Math.max(0, result.metadata.dataQuality - 70) / 4);
        }
      }
      break;
    case "organizer":
      if (hasExactMatch) boost += 65;
      else if (hasTokenPrefixMatch) boost += 35;
      else if (hasWordBoundaryMatch) boost += 10;
      else if (hasLoosePrefixMatch) boost -= 8;
      break;
    case "event":
    case "festival":
      if (hasExactMatch) boost += 40;
      else if (hasTokenPrefixMatch) boost += 10;
      else if (comparableTitleWordCount >= 4) boost -= 20;
      break;
    case "series":
    case "list":
      if (hasExactMatch) boost += 20;
      else if (comparableTitleWordCount >= 4) boost -= 10;
      break;
    default:
      break;
  }

  if (intent?.intent === "location" && result.type === "venue") {
    boost += 15;
  }

  if (intent?.intent === "organizer" && result.type === "organizer") {
    boost += 20;
  }

  return boost;
}

/**
 * Apply type priority boost based on intent analysis
 */
function applyTypePriorityBoost(
  score: number,
  type: SearchResult["type"],
  intent?: QueryIntentResult
): number {
  if (intent) {
    return applyIntentBoost(score, type as SearchType, intent);
  }
  // Default priority boost
  const priority = SCORING.TYPE_PRIORITY[type as keyof typeof SCORING.TYPE_PRIORITY] || 0;
  return score + priority;
}

// ============================================
// Main Search Functions
// ============================================

/**
 * Perform a unified search across events, venues, organizers, series, and lists.
 * Uses PostgreSQL full-text search with relevance ranking and fuzzy matching.
 * Optionally applies query intent analysis for smarter result prioritization.
 */
export async function unifiedSearch(
  options: SearchOptions
): Promise<UnifiedSearchResponse> {
  const {
    query,
    types = ["event", "venue", "organizer"],
    limit = 20,
    offset = 0,
    categories,
    subcategories,
    genres,
    tags,
    neighborhoods,
    dateFilter,
    isFree,
    portalId,
    city,
    useIntentAnalysis = true,
    boostExactMatches = true,
    includeFacets = true,
    includeDidYouMean = true,
    includeSocialProof = false,
    includeEventPopularitySignals = true,
    timingRecorder,
  } = options;

  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return { results: [], facets: [], total: 0 };
  }

  // Analyze query intent for smarter results
  const intent = useIntentAnalysis ? analyzeQueryIntent(trimmedQuery) : undefined;
  const effectiveQuery = intent ? extractCleanQuery(trimmedQuery, intent) : trimmedQuery;

  // Use intent-derived date filter if not explicitly provided
  // Map "tonight" to "today" for the event search (they're handled the same at DB level)
  const rawDateFilter = dateFilter || intent?.dateFilter;
  const effectiveDateFilter = rawDateFilter === "tonight" ? "today" : rawDateFilter;

  const client = createServiceClient();

  // Resolve portal city for venue search scoping only when venue results are requested.
  let resolvedCity = city;
  if (types.includes("venue") && !resolvedCity && portalId) {
    const cachedCity = portalCityCache.get(portalId);
    if (cachedCity && cachedCity.expiresAt > Date.now()) {
      resolvedCity = cachedCity.city;
    } else {
      const { data: portalData } = await measureSearchTiming(
        timingRecorder,
        "search_resolve_city",
        () =>
          client
            .from("portals")
            .select("filters")
            .eq("id", portalId)
            .maybeSingle(),
      );
      const pRow = portalData as {
        filters?: Record<string, unknown> | string | null;
      } | null;
      if (pRow?.filters) {
        const pf = (typeof pRow.filters === "string"
          ? JSON.parse(pRow.filters)
          : pRow.filters) as { city?: string };
        resolvedCity = pf.city || undefined;
      }
      portalCityCache.set(portalId, {
        city: resolvedCity,
        expiresAt: Date.now() + PORTAL_CITY_CACHE_TTL_MS,
      });
    }
  }

  // Calculate per-type limit for balanced results
  const limitPerType = Math.ceil(limit / types.length);
  const entityOverfetchLimit = Math.min(limitPerType + 4, 12);

  // Run searches in parallel
  const searchPromises: Promise<SearchResult[]>[] = [];
  const searchTypes: string[] = [];

  if (types.includes("event")) {
    searchTypes.push("event");
    searchPromises.push(
      measureSearchTiming(timingRecorder, "search_events_rpc", () =>
        searchEvents(client, effectiveQuery, {
          limit: limitPerType,
          offset,
          categories,
          genres: mergeSubcategoriesToGenres(subcategories, genres),
          tags,
          neighborhoods,
          dateFilter: effectiveDateFilter,
          isFree,
          portalId,
        }),
      )
    );
  }

  if (types.includes("venue")) {
    searchTypes.push("venue");
    searchPromises.push(
      measureSearchTiming(timingRecorder, "search_venues_rpc", () =>
        searchVenues(client, effectiveQuery, {
          limit: entityOverfetchLimit,
          offset,
          neighborhoods,
          city: resolvedCity,
        }),
      )
    );
  }

  if (types.includes("organizer")) {
    searchTypes.push("organizer");
    searchPromises.push(
      measureSearchTiming(timingRecorder, "search_organizers_rpc", () =>
        searchOrganizations(client, effectiveQuery, {
          limit: entityOverfetchLimit,
          offset,
          categories,
          portalId,
        }),
      )
    );
  }

  if (types.includes("series")) {
    searchTypes.push("series");
    searchPromises.push(
      measureSearchTiming(timingRecorder, "search_series_rpc", () =>
        searchSeries(client, effectiveQuery, {
          limit: limitPerType,
          offset,
          categories,
          portalId,
        }),
      )
    );
  }

  if (types.includes("list")) {
    searchTypes.push("list");
    searchPromises.push(
      measureSearchTiming(timingRecorder, "search_lists_rpc", () =>
        searchLists(client, effectiveQuery, {
          limit: limitPerType,
          offset,
          portalId,
        }),
      )
    );
  }

  if (types.includes("festival")) {
    searchTypes.push("festival");
    searchPromises.push(
      measureSearchTiming(timingRecorder, "search_festivals_rpc", () =>
        searchFestivals(client, effectiveQuery, {
          limit: limitPerType,
          offset,
          portalId,
        }),
      )
    );
  }

  // Execute the core searches and facets first.
  // Spelling suggestions are only useful for empty-result searches.
  const [searchResultsArrays, facets] = await Promise.all([
    Promise.all(searchPromises),
    includeFacets
      ? measureSearchTiming(timingRecorder, "search_facets", () =>
          getSearchFacets(client, effectiveQuery, portalId, resolvedCity),
        )
      : Promise.resolve([]),
  ]);

  // Combine all results
  let allResults: SearchResult[] = dedupeByTypeAndId(searchResultsArrays.flat());
  let eventCountsForResults:
    | Map<number, { going: number; interested: number; recommendations: number }>
    | null = null;

  // Always enrich events with basic social proof (rsvpCount, recommendationCount)
  // so the popularity multiplier in calculateRelevanceScore has data to work with.
  // The full social proof fanout (venue followers, etc.) is still gated on includeSocialProof.
  if (includeEventPopularitySignals) {
    const eventIds = allResults
      .filter((r) => r.type === "event")
      .map((r) => Number(r.id))
      .filter((id) => !Number.isNaN(id));
    if (eventIds.length > 0) {
      eventCountsForResults = await measureSearchTiming(
        timingRecorder,
        "search_event_social_proof",
        () => fetchSocialProofCounts(eventIds),
      );
      allResults = allResults.map((result) => {
        if (result.type !== "event") return result;
        const counts = eventCountsForResults?.get(Number(result.id));
        if (!counts) return result;
        return {
          ...result,
          metadata: {
            ...result.metadata,
            rsvpCount: counts.going + counts.interested,
            recommendationCount: counts.recommendations,
          },
        };
      });
    }
  }

  // Apply enhanced scoring
  if (boostExactMatches || intent) {
    allResults = allResults.map((result) => {
      let newScore = result.score;

      // Apply relevance scoring
      if (boostExactMatches) {
        newScore = calculateRelevanceScore(effectiveQuery, result.title, newScore, {
          date: result.metadata?.date,
          eventCount: result.metadata?.eventCount,
          followerCount: result.metadata?.followerCount,
          itemCount: result.metadata?.itemCount,
          rsvpCount: result.metadata?.rsvpCount,
          recommendationCount: result.metadata?.recommendationCount,
        });
      }

      // Apply intent-based type priority
      newScore = applyTypePriorityBoost(newScore, result.type, intent);
      newScore += applyCommittedEntityQueryBoost(trimmedQuery, result, intent);

      return { ...result, score: newScore };
    });
  }

  // Sort by enhanced score
  allResults.sort((a, b) => b.score - a.score);

  const didYouMean =
    includeDidYouMean && allResults.length === 0
      ? await measureSearchTiming(timingRecorder, "search_spelling", () =>
          getSpellingSuggestions(client, effectiveQuery, resolvedCity),
        )
      : [];

  if (includeSocialProof) {
    // Add social proof metadata for search cards
    const eventIds = allResults
      .filter((result) => result.type === "event")
      .map((result) => Number(result.id))
      .filter((id) => !Number.isNaN(id));
    const venueIds = allResults
      .filter((result) => result.type === "venue")
      .map((result) => Number(result.id))
      .filter((id) => !Number.isNaN(id));
    const organizerIds = allResults
      .filter((result) => result.type === "organizer")
      .map((result) => String(result.id));
    const seriesIds = allResults
      .filter((result) => result.type === "series")
      .map((result) => String(result.id));

    const [
      eventCounts,
      venueFollowData,
      venueRecData,
      organizerFollowData,
      organizerRecData,
      organizerLegacyRecData,
      seriesEvents,
    ] = await Promise.all([
      eventCountsForResults
        ? Promise.resolve(eventCountsForResults)
        : measureSearchTiming(timingRecorder, "search_event_social_proof", () =>
            fetchSocialProofCounts(eventIds),
          ),
      venueIds.length > 0
        ? client
            .from("follows")
            .select("followed_venue_id")
            .in("followed_venue_id", venueIds)
            .not("followed_venue_id", "is", null)
        : Promise.resolve({ data: null }),
      venueIds.length > 0
        ? client
            .from("recommendations")
            .select("venue_id")
            .in("venue_id", venueIds)
            .eq("visibility", "public")
        : Promise.resolve({ data: null }),
      organizerIds.length > 0
        ? client
            .from("follows")
            .select("followed_organization_id")
            .in("followed_organization_id", organizerIds)
            .not("followed_organization_id", "is", null)
        : Promise.resolve({ data: null }),
      organizerIds.length > 0
        ? client
            .from("recommendations")
            .select("organization_id")
            .in("organization_id", organizerIds)
            .eq("visibility", "public")
        : Promise.resolve({ data: null }),
      organizerIds.length > 0
        ? client
            .from("recommendations")
            .select("org_id")
            .in("org_id", organizerIds)
            .eq("visibility", "public")
        : Promise.resolve({ data: null }),
      seriesIds.length > 0
        ? client
            .from("events")
            .select("id, series_id")
            .in("series_id", seriesIds)
            .or("is_sensitive.eq.false,is_sensitive.is.null")
        : Promise.resolve({ data: null }),
    ]);

    const venueFollowerCounts = new Map<number, number>();
    for (const row of (venueFollowData?.data || []) as {
      followed_venue_id: number | null;
    }[]) {
      if (row.followed_venue_id) {
        venueFollowerCounts.set(
          row.followed_venue_id,
          (venueFollowerCounts.get(row.followed_venue_id) || 0) + 1,
        );
      }
    }

    const venueRecommendationCounts = new Map<number, number>();
    for (const row of (venueRecData?.data || []) as {
      venue_id: number | null;
    }[]) {
      if (row.venue_id) {
        venueRecommendationCounts.set(
          row.venue_id,
          (venueRecommendationCounts.get(row.venue_id) || 0) + 1,
        );
      }
    }

    const organizerFollowerCounts = new Map<string, number>();
    for (const row of (organizerFollowData?.data || []) as {
      followed_organization_id: string | null;
    }[]) {
      if (row.followed_organization_id) {
        organizerFollowerCounts.set(
          row.followed_organization_id,
          (organizerFollowerCounts.get(row.followed_organization_id) || 0) + 1,
        );
      }
    }

    const organizerRecommendationCounts = new Map<string, number>();
    for (const row of (organizerRecData?.data || []) as {
      organization_id: string | null;
    }[]) {
      if (row.organization_id) {
        organizerRecommendationCounts.set(
          row.organization_id,
          (organizerRecommendationCounts.get(row.organization_id) || 0) + 1,
        );
      }
    }
    for (const row of (organizerLegacyRecData?.data || []) as {
      org_id: string | null;
    }[]) {
      if (row.org_id) {
        organizerRecommendationCounts.set(
          row.org_id,
          (organizerRecommendationCounts.get(row.org_id) || 0) + 1,
        );
      }
    }

    const seriesEventIds = (seriesEvents?.data || []) as {
      id: number;
      series_id: string | null;
    }[];
    const seriesEventMap = new Map<string, number[]>();
    for (const row of seriesEventIds) {
      if (!row.series_id) continue;
      const list = seriesEventMap.get(row.series_id) || [];
      list.push(row.id);
      seriesEventMap.set(row.series_id, list);
    }
    const seriesCounts = new Map<string, { rsvp: number; recs: number }>();
    if (seriesEventIds.length > 0) {
      const seriesEventIdList = Array.from(
        new Set(seriesEventIds.map((row) => row.id)),
      );
      const seriesEventCounts = await measureSearchTiming(
        timingRecorder,
        "search_series_social_proof",
        () => fetchSocialProofCounts(seriesEventIdList),
      );
      for (const [seriesId, ids] of seriesEventMap.entries()) {
        let rsvp = 0;
        let recs = 0;
        for (const id of ids) {
          const counts = seriesEventCounts.get(id);
          if (counts) {
            rsvp += counts.going + counts.interested;
            recs += counts.recommendations;
          }
        }
        if (rsvp > 0 || recs > 0) {
          seriesCounts.set(seriesId, { rsvp, recs });
        }
      }
    }

    allResults = allResults.map((result) => {
      if (result.type === "event") {
        const counts = eventCounts.get(Number(result.id));
        return {
          ...result,
          metadata: {
            ...result.metadata,
            rsvpCount: counts ? counts.going + counts.interested : 0,
            recommendationCount: counts?.recommendations || 0,
          },
        };
      }
      if (result.type === "venue") {
        const id = Number(result.id);
        return {
          ...result,
          metadata: {
            ...result.metadata,
            followerCount: venueFollowerCounts.get(id) || 0,
            recommendationCount: venueRecommendationCounts.get(id) || 0,
          },
        };
      }
      if (result.type === "organizer") {
        const id = String(result.id);
        return {
          ...result,
          metadata: {
            ...result.metadata,
            followerCount: organizerFollowerCounts.get(id) || 0,
            recommendationCount: organizerRecommendationCounts.get(id) || 0,
          },
        };
      }
      if (result.type === "series") {
        const counts = seriesCounts.get(String(result.id));
        return {
          ...result,
          metadata: {
            ...result.metadata,
            rsvpCount: counts?.rsvp || 0,
            recommendationCount: counts?.recs || 0,
          },
        };
      }
      return result;
    });
  }

  // Calculate total from facets
  const total = facets.length > 0
    ? facets.reduce((sum, f) => sum + f.count, 0)
    : allResults.length;

  return {
    results: allResults.slice(0, limit),
    facets,
    total,
    didYouMean:
      includeDidYouMean && didYouMean.length > 0 ? didYouMean : undefined,
  };
}

/**
 * Search events using the search_events_ranked RPC function.
 */
async function searchEvents(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  options: {
    limit: number;
    offset: number;
    categories?: string[];
    genres?: string[];
    tags?: string[];
    neighborhoods?: string[];
    dateFilter?: "today" | "tomorrow" | "weekend" | "week";
    isFree?: boolean;
    portalId?: string;
  }
): Promise<SearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_events_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_categories: options.categories || null,
    p_neighborhoods: options.neighborhoods || null,
    p_date_filter: mapDateFilter(options.dateFilter),
    p_is_free: options.isFree ?? null,
    p_portal_id: options.portalId || null,
    p_subcategories: null, // deprecated, kept for backwards compat
    p_genres: options.genres || null,
    p_tags: options.tags || null,
  });

  if (error) {
    console.error("Error searching events:", error);
    return [];
  }

  const rows = (data as EventSearchRow[]) || [];

  return rows.map((row) => ({
    id: row.id,
    type: "event" as const,
    title: row.title,
    subtitle: row.venue_name || undefined,
    href: `/event/${row.id}`,
    score: row.combined_score,
    metadata: {
      date: row.start_date,
      time: row.start_time || undefined,
      neighborhood: row.venue_neighborhood || undefined,
      category: row.category || undefined,
      isFree: row.is_free,
    },
  }));
}

/**
 * Search venues using the search_venues_ranked RPC function.
 */
async function searchVenues(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  options: {
    limit: number;
    offset: number;
    neighborhoods?: string[];
    spotTypes?: string[];
    vibes?: string[];
    city?: string;
  }
): Promise<SearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_venues_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_neighborhoods: options.neighborhoods || null,
    p_spot_types: options.spotTypes || null,
    p_vibes: options.vibes || null,
    p_city: options.city || null,
  });

  if (error) {
    console.error("Error searching venues:", error);
    return [];
  }

  const rows = (data as VenueSearchRow[]) || [];

  return rows.map((row) => ({
    id: row.id,
    type: "venue" as const,
    title: row.name,
    subtitle: row.neighborhood || undefined,
    href: `/venue/${row.slug}`,
    score: row.combined_score,
    metadata: {
      neighborhood: row.neighborhood || undefined,
      venueType: row.venue_type || undefined,
      vibes: row.vibes || undefined,
      featured: row.featured ?? undefined,
      exploreFeatured: row.explore_featured ?? undefined,
      dataQuality: row.data_quality ?? undefined,
      isEventVenue: row.is_event_venue ?? undefined,
    },
  }));
}

/**
 * Search organizations/organizers using the search_organizations_ranked RPC function.
 */
async function searchOrganizations(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  options: {
    limit: number;
    offset: number;
    orgTypes?: string[];
    categories?: string[];
    portalId?: string;
  }
): Promise<SearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_organizations_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_org_types: options.orgTypes || null,
    p_categories: options.categories || null,
    p_portal_id: options.portalId || null,
  });

  if (error) {
    console.error("Error searching organizations:", error);
    return [];
  }

  const rows = (data as OrganizationSearchRow[]) || [];

  return rows.map((row) => ({
    id: row.id,
    type: "organizer" as const,
    title: row.name,
    subtitle: row.org_type || undefined,
    href: `/organizer/${row.slug}`,
    score: row.combined_score,
    metadata: {
      orgType: row.org_type || undefined,
      neighborhood: row.neighborhood || undefined,
      eventCount: row.total_events_tracked || undefined,
    },
  }));
}

/**
 * Search series using the search_series_ranked RPC function.
 */
async function searchSeries(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  options: {
    limit: number;
    offset: number;
    categories?: string[];
    portalId?: string;
  }
): Promise<SearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_series_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_categories: options.categories || null,
    p_portal_id: options.portalId || null,
  });

  if (error) {
    console.error("Error searching series:", error);
    return [];
  }

  const rows = (data as SeriesSearchRow[]) || [];

  return rows.map((row) => ({
    id: row.id,
    type: "series" as const,
    title: row.title,
    subtitle: row.series_type || undefined,
    href: `/series/${row.slug}`,
    score: row.combined_score,
    metadata: {
      category: row.category || undefined,
      seriesType: row.series_type || undefined,
      eventCount: row.upcoming_event_count || 0,
      nextEventDate: row.next_event_date || undefined,
    },
  }));
}

/**
 * Search lists using the search_lists_ranked RPC function.
 */
async function searchLists(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  options: {
    limit: number;
    offset: number;
    portalId?: string;
  }
): Promise<SearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_lists_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_portal_id: options.portalId || null,
  });

  if (error) {
    console.error("Error searching lists:", error);
    return [];
  }

  const rows = (data as ListSearchRow[]) || [];

  return rows.map((row) => ({
    id: row.id,
    type: "list" as const,
    title: row.title,
    subtitle: row.category || undefined,
    href: `/list/${row.slug}`,
    score: row.combined_score,
    metadata: {
      category: row.category || undefined,
      itemCount: row.item_count || 0,
      curatorName: row.creator_name || undefined,
    },
  }));
}

/**
 * Search festivals using the search_festivals_ranked RPC function.
 */
async function searchFestivals(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  options: {
    limit: number;
    offset: number;
    portalId?: string;
  }
): Promise<SearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_festivals_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_portal_id: options.portalId || null,
  });

  if (error) {
    console.error("Error searching festivals:", error);
    return [];
  }

  const rows = (data as FestivalSearchRow[]) || [];

  return rows.map((row) => ({
    id: row.id,
    type: "festival" as const,
    title: row.name,
    subtitle: row.announced_start
      ? formatFestivalDateRange(row.announced_start, row.announced_end)
      : undefined,
    href: `/festivals/${row.slug}`,
    score: row.combined_score,
    metadata: {
      category: row.primary_type || row.festival_type || undefined,
      date: row.announced_start || undefined,
    },
  }));
}

/**
 * Format festival date range for subtitle display.
 */
function formatFestivalDateRange(start: string, end: string | null): string {
  try {
    const startDate = new Date(start + "T00:00:00");
    const startStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!end || end === start) return startStr;
    const endDate = new Date(end + "T00:00:00");
    const endStr = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${startStr} – ${endStr}`;
  } catch {
    return start;
  }
}

/**
 * Get search facets (counts per entity type).
 */
async function getSearchFacets(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  portalId?: string,
  city?: string
): Promise<SearchFacet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("get_search_facets", {
    p_query: query,
    p_portal_id: portalId || null,
    p_city: city || null,
  });

  if (error) {
    console.error("Error getting search facets:", error);
    return [];
  }

  const rows = (data as FacetRow[]) || [];

  return rows.map((row) => ({
    type: row.entity_type as "event" | "venue" | "organizer" | "series" | "list" | "festival",
    count: Number(row.count),
  }));
}

/**
 * Get spelling suggestions for likely typos.
 */
async function getSpellingSuggestions(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  city?: string
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("get_spelling_suggestions", {
    p_query: query,
    p_limit: 3,
    p_city: city || null,
  });

  if (error) {
    console.error("Error getting spelling suggestions:", error);
    return [];
  }

  const rows = (data as SpellingSuggestionRow[]) || [];

  return rows.map((row) => row.suggestion);
}

// ============================================
// Quick Search (for instant endpoint)
// ============================================

export interface InstantSearchResponse {
  suggestions: SearchResult[];
  topResults: SearchResult[];
  facets: SearchFacet[];
  intent?: {
    type: string;
    confidence: number;
    dateFilter?: string;
  };
}

/**
 * Perform a quick search optimized for instant/autocomplete use.
 * Returns both autocomplete suggestions and top results in a single call.
 */
export async function instantSearch(
  query: string,
  options: {
    portalId?: string;
    city?: string;
    limit?: number;
    types?: ("event" | "venue" | "organizer" | "series" | "list" | "festival")[];
    includeSocialProof?: boolean;
    includeFacets?: boolean;
    includeDidYouMean?: boolean;
    includeEventPopularitySignals?: boolean;
    timingRecorder?: SearchTimingRecorder;
  } = {}
): Promise<InstantSearchResponse> {
  const {
    portalId,
    city,
    limit = 8,
    types,
    includeSocialProof = false,
    includeFacets = false,
    includeDidYouMean = false,
    includeEventPopularitySignals = false,
    timingRecorder,
  } = options;
  const trimmedQuery = query.trim();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    return { suggestions: [], topResults: [], facets: [] };
  }

  // Analyze intent
  const intent = analyzeQueryIntent(trimmedQuery);
  const selectedTypes =
    types ||
    (trimmedQuery.length >= 4
      ? ["event", "venue", "organizer", "series", "list", "festival"]
      : ["event", "venue", "organizer"]);

  // Perform unified search with all types
  const searchResult = await unifiedSearch({
    query: trimmedQuery,
    types: selectedTypes,
    limit: limit * 2, // Get more to split between suggestions and results
    portalId,
    city,
    useIntentAnalysis: true,
    boostExactMatches: true,
    includeSocialProof,
    includeFacets,
    includeDidYouMean,
    includeEventPopularitySignals,
    timingRecorder,
  });

  // Split results: top matches as suggestions, rest as results
  const suggestions = searchResult.results.slice(0, limit);
  const topResults = searchResult.results.slice(limit, limit * 2);

  return {
    suggestions,
    topResults,
    facets: searchResult.facets,
    intent: {
      type: intent.intent,
      confidence: intent.confidence,
      dateFilter: intent.dateFilter,
    },
  };
}

// Export intent analysis for use in other modules
export { analyzeQueryIntent, type QueryIntentResult } from "./query-intent";
