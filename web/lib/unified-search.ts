/**
 * Unified Search Library
 *
 * Provides full-text search across events, venues, organizers, series, and lists
 * using PostgreSQL tsvector/tsquery with pg_trgm for fuzzy matching.
 * Includes multi-factor scoring and query intent analysis for improved relevance.
 */

import { createServiceClient } from "./supabase/service";
import { analyzeQueryIntent, applyIntentBoost, type QueryIntentResult, type SearchType } from "./query-intent";
import { getLocalDateString } from "@/lib/formats";

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: number | string;
  type: "event" | "venue" | "organizer" | "series" | "list" | "neighborhood" | "category";
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
    // Series-specific
    seriesType?: string;
    nextEventDate?: string;
    // List-specific
    itemCount?: number;
    curatorName?: string;
  };
}

export interface SearchOptions {
  query: string;
  types?: ("event" | "venue" | "organizer" | "series" | "list")[];
  limit?: number;
  offset?: number;
  categories?: string[];
  subcategories?: string[]; // Filter by subcategory values (e.g., "nightlife.trivia")
  tags?: string[]; // Filter by event tags (e.g., "outdoor", "21+")
  neighborhoods?: string[];
  dateFilter?: "today" | "tonight" | "tomorrow" | "weekend" | "week";
  isFree?: boolean;
  portalId?: string;
  // Enhanced options
  useIntentAnalysis?: boolean; // Enable query intent analysis for smarter results
  boostExactMatches?: boolean; // Apply extra boost for exact title matches
}

export interface SearchFacet {
  type: "event" | "venue" | "organizer" | "series" | "list";
  count: number;
}

export interface UnifiedSearchResponse {
  results: SearchResult[];
  facets: SearchFacet[];
  total: number;
  didYouMean?: string[];
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
    organizer: 3,
    series: 2,
    list: 1,
  },
} as const;

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

  // Recency boost for events
  if (metadata?.date) {
    const daysUntil = getDaysUntilDate(metadata.date);
    if (daysUntil >= 0 && daysUntil <= 30) {
      // More boost for sooner events
      score += SCORING.RECENCY_MAX * (1 - daysUntil / 30);
    }
  }

  // Popularity boost
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
 * Get days until a date (negative if past)
 */
function getDaysUntilDate(dateStr: string): number {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = date.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch {
    return 999; // Far future if can't parse
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    tags,
    neighborhoods,
    dateFilter,
    isFree,
    portalId,
    useIntentAnalysis = true,
    boostExactMatches = true,
  } = options;

  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return { results: [], facets: [], total: 0 };
  }

  // Analyze query intent for smarter results
  const intent = useIntentAnalysis ? analyzeQueryIntent(trimmedQuery) : undefined;

  // Use intent-derived date filter if not explicitly provided
  // Map "tonight" to "today" for the event search (they're handled the same at DB level)
  const rawDateFilter = dateFilter || intent?.dateFilter;
  const effectiveDateFilter = rawDateFilter === "tonight" ? "today" : rawDateFilter;

  const client = createServiceClient();

  // Calculate per-type limit for balanced results
  const limitPerType = Math.ceil(limit / types.length);

  // Run searches in parallel
  const searchPromises: Promise<SearchResult[]>[] = [];
  const searchTypes: string[] = [];

  if (types.includes("event")) {
    searchTypes.push("event");
    searchPromises.push(
      searchEvents(client, trimmedQuery, {
        limit: limitPerType,
        offset,
        categories,
        subcategories,
        tags,
        neighborhoods,
        dateFilter: effectiveDateFilter,
        isFree,
        portalId,
      })
    );
  }

  if (types.includes("venue")) {
    searchTypes.push("venue");
    searchPromises.push(
      searchVenues(client, trimmedQuery, {
        limit: limitPerType,
        offset,
        neighborhoods,
      })
    );
  }

  if (types.includes("organizer")) {
    searchTypes.push("organizer");
    searchPromises.push(
      searchOrganizations(client, trimmedQuery, {
        limit: limitPerType,
        offset,
        categories,
      })
    );
  }

  if (types.includes("series")) {
    searchTypes.push("series");
    searchPromises.push(
      searchSeries(client, trimmedQuery, {
        limit: limitPerType,
        offset,
        categories,
      })
    );
  }

  if (types.includes("list")) {
    searchTypes.push("list");
    searchPromises.push(
      searchLists(client, trimmedQuery, {
        limit: limitPerType,
        offset,
        portalId,
      })
    );
  }

  // Execute searches, facets, and spelling suggestions in parallel
  const [searchResultsArrays, facets, didYouMean] = await Promise.all([
    Promise.all(searchPromises),
    getSearchFacets(client, trimmedQuery, portalId),
    getSpellingSuggestions(client, trimmedQuery),
  ]);

  // Combine all results
  let allResults: SearchResult[] = searchResultsArrays.flat();

  // Apply enhanced scoring
  if (boostExactMatches || intent) {
    allResults = allResults.map((result) => {
      let newScore = result.score;

      // Apply relevance scoring
      if (boostExactMatches) {
        newScore = calculateRelevanceScore(trimmedQuery, result.title, newScore, {
          date: result.metadata?.date,
          eventCount: result.metadata?.eventCount,
          followerCount: result.metadata?.followerCount,
          itemCount: result.metadata?.itemCount,
        });
      }

      // Apply intent-based type priority
      newScore = applyTypePriorityBoost(newScore, result.type, intent);

      return { ...result, score: newScore };
    });
  }

  // Sort by enhanced score
  allResults.sort((a, b) => b.score - a.score);

  // Calculate total from facets
  const total = facets.reduce((sum, f) => sum + f.count, 0);

  return {
    results: allResults.slice(0, limit),
    facets,
    total,
    didYouMean: didYouMean.length > 0 ? didYouMean : undefined,
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
    subcategories?: string[];
    tags?: string[];
    neighborhoods?: string[];
    dateFilter?: "today" | "tomorrow" | "weekend" | "week";
    isFree?: boolean;
    portalId?: string;
  }
): Promise<SearchResult[]> {
  // Request more results if we have client-side filters that may reduce count
  const hasClientFilters = (options.subcategories && options.subcategories.length > 0) ||
    (options.tags && options.tags.length > 0);
  const fetchLimit = hasClientFilters ? options.limit * 3 : options.limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_events_ranked", {
    p_query: query,
    p_limit: fetchLimit,
    p_offset: options.offset,
    p_categories: options.categories || null,
    p_neighborhoods: options.neighborhoods || null,
    p_date_filter: mapDateFilter(options.dateFilter),
    p_is_free: options.isFree ?? null,
    p_portal_id: options.portalId || null,
  });

  if (error) {
    console.error("Error searching events:", error);
    return [];
  }

  let rows = (data as EventSearchRow[]) || [];

  // Apply client-side subcategory filter
  // If event has a subcategory, it must match one of the selected subcategories
  // If event has no subcategory, include it if its category matches the parent category
  // (e.g., selecting "music.live" should also include events with category="music" and subcategory=null)
  if (options.subcategories && options.subcategories.length > 0) {
    // Extract parent categories from subcategory values (e.g., "music.live" -> "music")
    const parentCategories = new Set(
      options.subcategories.map((sub) => sub.split(".")[0])
    );

    rows = rows.filter((row) => {
      // If event has a subcategory, it must match exactly
      if (row.subcategory) {
        return options.subcategories!.includes(row.subcategory);
      }
      // If event has no subcategory, include it if its category matches a parent category
      return row.category && parentCategories.has(row.category);
    });
  }

  // Apply client-side tags filter (match any tag)
  if (options.tags && options.tags.length > 0) {
    rows = rows.filter((row) =>
      row.tags && row.tags.some((tag) => options.tags!.includes(tag))
    );
  }

  // Respect the original limit
  rows = rows.slice(0, options.limit);

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
  }
): Promise<SearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_organizations_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_org_types: options.orgTypes || null,
    p_categories: options.categories || null,
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
 * Search series using direct table query with trigram similarity.
 */
async function searchSeries(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  options: {
    limit: number;
    offset: number;
    categories?: string[];
  }
): Promise<SearchResult[]> {
  try {
    // Build query with trigram similarity
    let supabaseQuery = client
      .from("series")
      .select(`
        id,
        title,
        slug,
        description,
        series_type,
        image_url,
        category,
        is_active
      `)
      .eq("is_active", true)
      .ilike("title", `%${query}%`)
      .limit(options.limit)
      .range(options.offset, options.offset + options.limit - 1);

    // Apply category filter
    if (options.categories && options.categories.length > 0) {
      supabaseQuery = supabaseQuery.in("category", options.categories);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error("Error searching series:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Type the data explicitly
    type SeriesRow = {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      series_type: string | null;
      image_url: string | null;
      category: string | null;
      is_active: boolean;
    };
    const typedData = data as SeriesRow[];

    // Get event counts for each series
    const seriesIds = typedData.map((s) => s.id);
    const { data: eventCounts } = await client
      .from("events")
      .select("series_id")
      .in("series_id", seriesIds)
      .gte("start_date", getLocalDateString());

    const countMap = new Map<string, number>();
    (eventCounts as Array<{ series_id: string | null }> | null)?.forEach((e) => {
      const id = e.series_id as string;
      if (id) {
        countMap.set(id, (countMap.get(id) || 0) + 1);
      }
    });

    return typedData.map((row) => {
      // Calculate similarity score
      const titleLower = row.title.toLowerCase();
      const queryLower = query.toLowerCase();
      const similarity = titleLower.includes(queryLower)
        ? titleLower.startsWith(queryLower)
          ? 0.9
          : 0.6
        : 0.3;

      return {
        id: row.id,
        type: "series" as const,
        title: row.title,
        subtitle: row.series_type || undefined,
        href: `/series/${row.slug}`,
        score: similarity * 100,
        metadata: {
          category: row.category || undefined,
          seriesType: row.series_type || undefined,
          eventCount: countMap.get(row.id) || 0,
        },
      };
    });
  } catch (error) {
    console.error("Error in searchSeries:", error);
    return [];
  }
}

/**
 * Search lists using direct table query with trigram similarity.
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
  try {
    // Build query
    let supabaseQuery = client
      .from("lists")
      .select(`
        id,
        title,
        slug,
        description,
        category,
        creator_id,
        is_public,
        status
      `)
      .eq("is_public", true)
      .eq("status", "active")
      .ilike("title", `%${query}%`)
      .limit(options.limit)
      .range(options.offset, options.offset + options.limit - 1);

    // Apply portal filter
    if (options.portalId) {
      supabaseQuery = supabaseQuery.eq("portal_id", options.portalId);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error("Error searching lists:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Type the data explicitly
    type ListRow = {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      category: string | null;
      creator_id: string;
      is_public: boolean;
      status: string;
    };
    const typedData = data as ListRow[];

    // Get item counts and creator names
    const listIds = typedData.map((l) => l.id);
    const [itemCountsResult, creatorsResult] = await Promise.all([
      client.from("list_items").select("list_id").in("list_id", listIds),
      client.from("profiles").select("id, display_name").in(
        "id",
        typedData.map((l) => l.creator_id)
      ),
    ]);

    const itemCountMap = new Map<string, number>();
    (itemCountsResult.data as Array<{ list_id: string }> | null)?.forEach((item) => {
      const id = item.list_id;
      itemCountMap.set(id, (itemCountMap.get(id) || 0) + 1);
    });

    const creatorMap = new Map<string, string>();
    (creatorsResult.data as Array<{ id: string; display_name: string | null }> | null)?.forEach((profile) => {
      creatorMap.set(profile.id, profile.display_name || "Unknown");
    });

    return typedData.map((row) => {
      // Calculate similarity score
      const titleLower = row.title.toLowerCase();
      const queryLower = query.toLowerCase();
      const similarity = titleLower.includes(queryLower)
        ? titleLower.startsWith(queryLower)
          ? 0.9
          : 0.6
        : 0.3;

      return {
        id: row.id,
        type: "list" as const,
        title: row.title,
        subtitle: row.category || undefined,
        href: `/list/${row.slug}`,
        score: similarity * 100,
        metadata: {
          category: row.category || undefined,
          itemCount: itemCountMap.get(row.id) || 0,
          curatorName: creatorMap.get(row.creator_id) || undefined,
        },
      };
    });
  } catch (error) {
    console.error("Error in searchLists:", error);
    return [];
  }
}

/**
 * Get search facets (counts per entity type).
 */
async function getSearchFacets(
  client: ReturnType<typeof createServiceClient>,
  query: string,
  portalId?: string
): Promise<SearchFacet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("get_search_facets", {
    p_query: query,
    p_portal_id: portalId || null,
  });

  if (error) {
    console.error("Error getting search facets:", error);
    return [];
  }

  const rows = (data as FacetRow[]) || [];

  return rows.map((row) => ({
    type: row.entity_type as "event" | "venue" | "organizer",
    count: Number(row.count),
  }));
}

/**
 * Get spelling suggestions for likely typos.
 */
async function getSpellingSuggestions(
  client: ReturnType<typeof createServiceClient>,
  query: string
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("get_spelling_suggestions", {
    p_query: query,
    p_limit: 3,
  });

  if (error) {
    console.error("Error getting spelling suggestions:", error);
    return [];
  }

  const rows = (data as SpellingSuggestionRow[]) || [];

  return rows.map((row) => row.suggestion);
}

// ============================================
// Exported Search Functions for Components
// ============================================

/**
 * Search events only (for event-specific search contexts).
 * Returns full event data with venue information.
 */
export async function searchEventsOnly(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    categories?: string[];
    subcategories?: string[];
    tags?: string[];
    neighborhoods?: string[];
    dateFilter?: "today" | "tomorrow" | "weekend" | "week";
    isFree?: boolean;
    portalId?: string;
  } = {}
): Promise<EventSearchRow[]> {
  const client = createServiceClient();

  // Request more results if we have client-side filters
  const hasClientFilters = (options.subcategories && options.subcategories.length > 0) ||
    (options.tags && options.tags.length > 0);
  const fetchLimit = hasClientFilters ? (options.limit || 20) * 3 : (options.limit || 20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_events_ranked", {
    p_query: query.trim(),
    p_limit: fetchLimit,
    p_offset: options.offset || 0,
    p_categories: options.categories || null,
    p_neighborhoods: options.neighborhoods || null,
    p_date_filter: mapDateFilter(options.dateFilter),
    p_is_free: options.isFree ?? null,
    p_portal_id: options.portalId || null,
  });

  if (error) {
    console.error("Error searching events:", error);
    return [];
  }

  let rows = (data as EventSearchRow[]) || [];

  // Apply client-side subcategory filter
  // If event has a subcategory, it must match one of the selected subcategories
  // If event has no subcategory, include it if its category matches the parent category
  // (e.g., selecting "music.live" should also include events with category="music" and subcategory=null)
  if (options.subcategories && options.subcategories.length > 0) {
    // Extract parent categories from subcategory values (e.g., "music.live" -> "music")
    const parentCategories = new Set(
      options.subcategories.map((sub) => sub.split(".")[0])
    );

    rows = rows.filter((row) => {
      // If event has a subcategory, it must match exactly
      if (row.subcategory) {
        return options.subcategories!.includes(row.subcategory);
      }
      // If event has no subcategory, include it if its category matches a parent category
      return row.category && parentCategories.has(row.category);
    });
  }

  // Apply client-side tags filter (match any tag)
  if (options.tags && options.tags.length > 0) {
    rows = rows.filter((row) =>
      row.tags && row.tags.some((tag) => options.tags!.includes(tag))
    );
  }

  // Respect the original limit
  return rows.slice(0, options.limit || 20);
}

/**
 * Search venues only (for venue-specific search contexts).
 */
export async function searchVenuesOnly(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    neighborhoods?: string[];
    spotTypes?: string[];
    vibes?: string[];
  } = {}
): Promise<VenueSearchRow[]> {
  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_venues_ranked", {
    p_query: query.trim(),
    p_limit: options.limit || 10,
    p_offset: options.offset || 0,
    p_neighborhoods: options.neighborhoods || null,
    p_spot_types: options.spotTypes || null,
    p_vibes: options.vibes || null,
  });

  if (error) {
    console.error("Error searching venues:", error);
    return [];
  }

  return (data as VenueSearchRow[]) || [];
}

/**
 * Search organizations only (for organizer-specific search contexts).
 */
export async function searchOrganizationsOnly(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    orgTypes?: string[];
    categories?: string[];
  } = {}
): Promise<OrganizationSearchRow[]> {
  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_organizations_ranked", {
    p_query: query.trim(),
    p_limit: options.limit || 10,
    p_offset: options.offset || 0,
    p_org_types: options.orgTypes || null,
    p_categories: options.categories || null,
  });

  if (error) {
    console.error("Error searching organizations:", error);
    return [];
  }

  return (data as OrganizationSearchRow[]) || [];
}

// Re-export types for convenience
export type { EventSearchRow, VenueSearchRow, OrganizationSearchRow };

// ============================================
// Quick Search (for instant endpoint)
// ============================================

export interface InstantSearchResponse {
  suggestions: SearchResult[];
  topResults: SearchResult[];
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
    limit?: number;
  } = {}
): Promise<InstantSearchResponse> {
  const { portalId, limit = 8 } = options;
  const trimmedQuery = query.trim();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    return { suggestions: [], topResults: [] };
  }

  // Analyze intent
  const intent = analyzeQueryIntent(trimmedQuery);

  // Perform unified search with all types
  const searchResult = await unifiedSearch({
    query: trimmedQuery,
    types: ["event", "venue", "organizer", "series", "list"],
    limit: limit * 2, // Get more to split between suggestions and results
    portalId,
    useIntentAnalysis: true,
    boostExactMatches: true,
  });

  // Split results: top matches as suggestions, rest as results
  const suggestions = searchResult.results.slice(0, limit);
  const topResults = searchResult.results.slice(limit, limit * 2);

  return {
    suggestions,
    topResults,
    intent: {
      type: intent.intent,
      confidence: intent.confidence,
      dateFilter: intent.dateFilter,
    },
  };
}

// Export intent analysis for use in other modules
export { analyzeQueryIntent, type QueryIntentResult } from "./query-intent";
