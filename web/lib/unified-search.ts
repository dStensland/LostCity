/**
 * Unified Search Library
 *
 * Provides full-text search across events, venues, and organizers using
 * PostgreSQL tsvector/tsquery with pg_trgm for fuzzy matching.
 */

import { createServiceClient } from "./supabase/service";

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: number | string;
  type: "event" | "venue" | "organizer";
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
    spotType?: string;
    vibes?: string[];
    orgType?: string;
    eventCount?: number;
  };
}

export interface SearchOptions {
  query: string;
  types?: ("event" | "venue" | "organizer")[];
  limit?: number;
  offset?: number;
  categories?: string[];
  neighborhoods?: string[];
  dateFilter?: "today" | "tomorrow" | "weekend" | "week";
  isFree?: boolean;
  portalId?: string;
}

export interface SearchFacet {
  type: "event" | "venue" | "organizer";
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
  spot_type: string | null;
  spot_types: string[] | null;
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

interface ProducerSearchRow {
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
  filter: "today" | "tomorrow" | "weekend" | "week" | undefined
): string | null {
  return filter || null;
}

// ============================================
// Main Search Functions
// ============================================

/**
 * Perform a unified search across events, venues, and organizers.
 * Uses PostgreSQL full-text search with relevance ranking and fuzzy matching.
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
    neighborhoods,
    dateFilter,
    isFree,
    portalId,
  } = options;

  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return { results: [], facets: [], total: 0 };
  }

  const client = createServiceClient();

  // Calculate per-type limit for balanced results
  const limitPerType = Math.ceil(limit / types.length);

  // Run searches in parallel
  const [eventResults, venueResults, producerResults, facets, didYouMean] =
    await Promise.all([
      types.includes("event")
        ? searchEvents(client, trimmedQuery, {
            limit: limitPerType,
            offset,
            categories,
            neighborhoods,
            dateFilter,
            isFree,
            portalId,
          })
        : Promise.resolve([] as SearchResult[]),
      types.includes("venue")
        ? searchVenues(client, trimmedQuery, {
            limit: limitPerType,
            offset,
            neighborhoods,
          })
        : Promise.resolve([] as SearchResult[]),
      types.includes("organizer")
        ? searchProducers(client, trimmedQuery, {
            limit: limitPerType,
            offset,
            categories,
          })
        : Promise.resolve([] as SearchResult[]),
      getSearchFacets(client, trimmedQuery, portalId),
      getSpellingSuggestions(client, trimmedQuery),
    ]);

  // Combine and sort all results by score
  const allResults = [
    ...eventResults,
    ...venueResults,
    ...producerResults,
  ].sort((a, b) => b.score - a.score);

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
      spotType: row.spot_type || undefined,
      vibes: row.vibes || undefined,
    },
  }));
}

/**
 * Search producers/organizers using the search_producers_ranked RPC function.
 */
async function searchProducers(
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
  const { data, error } = await (client.rpc as any)("search_producers_ranked", {
    p_query: query,
    p_limit: options.limit,
    p_offset: options.offset,
    p_org_types: options.orgTypes || null,
    p_categories: options.categories || null,
  });

  if (error) {
    console.error("Error searching producers:", error);
    return [];
  }

  const rows = (data as ProducerSearchRow[]) || [];

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
    neighborhoods?: string[];
    dateFilter?: "today" | "tomorrow" | "weekend" | "week";
    isFree?: boolean;
    portalId?: string;
  } = {}
): Promise<EventSearchRow[]> {
  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_events_ranked", {
    p_query: query.trim(),
    p_limit: options.limit || 20,
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

  return (data as EventSearchRow[]) || [];
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
 * Search producers only (for organizer-specific search contexts).
 */
export async function searchProducersOnly(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    orgTypes?: string[];
    categories?: string[];
  } = {}
): Promise<ProducerSearchRow[]> {
  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)("search_producers_ranked", {
    p_query: query.trim(),
    p_limit: options.limit || 10,
    p_offset: options.offset || 0,
    p_org_types: options.orgTypes || null,
    p_categories: options.categories || null,
  });

  if (error) {
    console.error("Error searching producers:", error);
    return [];
  }

  return (data as ProducerSearchRow[]) || [];
}

// Re-export types for convenience
export type { EventSearchRow, VenueSearchRow, ProducerSearchRow };
