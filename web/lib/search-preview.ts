import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeSQLPattern } from "@/lib/api-utils";
import {
  getPortalSourceAccess,
  isEventCategoryAllowedForSourceAccess,
  type PortalSourceAccess,
} from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";
import {
  applyFederatedPortalScopeToQuery,
  filterByPortalCity,
} from "@/lib/portal-scope";
import type { SearchFacet, SearchResult, UnifiedSearchResponse } from "@/lib/unified-search";
import { getSearchSuggestionsWithFallback } from "@/lib/search-suggestions";
import { mapSuggestionToSearchResult } from "@/lib/search-suggestion-results";
import { getFindSearchSubtitle } from "@/lib/find-labels";
import type { FindType } from "@/lib/find-filter-schema";

export type PreviewSearchType = "event" | "venue" | "organizer";

type TimingRecorder = {
  measure<T>(name: string, fn: () => Promise<T> | T, desc?: string): Promise<T>;
};

type EventPreviewRow = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  source_id?: number | null;
  category_id: string | null;
  tags: string[] | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    image_url?: string | null;
    location_designator?:
      | "standard"
      | "private_after_signup"
      | "virtual"
      | "recovery_meeting"
      | null;
  } | null;
};

type VenuePreviewRow = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  aliases: string[] | null;
  venue_type: string | null;
  vibes?: string[] | null;
};

type OrganizationPortalSchema = {
  public: {
    Tables: {
      organization_portals: {
        Row: {
          organization_id: string;
        };
      };
    };
  };
};

type OrganizationPreviewRow = {
  id: string;
  name: string;
  slug: string;
  org_type: string | null;
  neighborhood: string | null;
  featured: boolean | null;
  total_events_tracked: number | null;
  is_verified: boolean | null;
};

function buildPreviewResponse(results: SearchResult[]): UnifiedSearchResponse {
  const facetTypes = new Set<SearchFacet["type"]>([
    "event",
    "venue",
    "organizer",
    "series",
    "list",
    "festival",
  ]);
  const counts = new Map<SearchFacet["type"], number>();
  for (const result of results) {
    if (!facetTypes.has(result.type as SearchFacet["type"])) {
      continue;
    }
    const facetType = result.type as SearchFacet["type"];
    counts.set(facetType, (counts.get(facetType) || 0) + 1);
  }

  const facets: SearchFacet[] = Array.from(counts.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  return {
    results,
    facets,
    total: results.length,
  };
}

export function buildDirectQueryFallbackResults(
  query: string,
  portalSlug: string,
  requestedTypes: PreviewSearchType[],
  findType?: FindType | null,
): SearchResult[] {
  const results: SearchResult[] = [];
  const eventTarget = findType === "classes" ? "classes" : "events";

  if (requestedTypes.includes("event")) {
    results.push({
      id: `search:query:event:${query.toLowerCase()}`,
      type: "event",
      title: query,
      subtitle: findType === "classes" ? "Search classes" : "Search events",
      href: `/${portalSlug}?view=happening&search=${encodeURIComponent(query)}`,
      score: 560,
    });
  }

  if (requestedTypes.includes("venue")) {
    results.push({
      id: `search:query:venue:${query.toLowerCase()}`,
      type: "venue",
      title: query,
      subtitle: getFindSearchSubtitle("venue"),
      href: `/${portalSlug}?view=places&search=${encodeURIComponent(query)}`,
      score: 540,
    });
  }

  return results;
}

function computePreviewScore(
  normalizedQuery: string,
  candidate: string,
  typeBoost: number,
): number {
  const normalizedCandidate = candidate.trim().toLowerCase();

  if (normalizedCandidate === normalizedQuery) {
    return 1000 + typeBoost;
  }
  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 700 + typeBoost;
  }
  if (normalizedCandidate.includes(normalizedQuery)) {
    return 400 + typeBoost;
  }
  return typeBoost;
}

async function previewEvents(
  supabase: SupabaseClient,
  normalizedQuery: string,
  escapedQuery: string,
  limit: number,
  portalId: string | null,
  sourceAccess: PortalSourceAccess | null,
  portalCity: string | undefined,
): Promise<SearchResult[]> {
  const buildQuery = (pattern: string) => {
    let query = supabase
      .from("events")
      .select(
        `
        id,
        title,
        start_date,
        end_date,
        is_all_day,
        source_id,
        category_id,
        tags,
        venue:venues(id, name, neighborhood, city, lat, lng, image_url, location_designator)
      `,
      )
      .ilike("title", pattern)
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .or(
        `start_date.gte.${new Date().toISOString().split("T")[0]},end_date.gte.${new Date().toISOString().split("T")[0]}`,
      )
      .order("start_date", { ascending: true })
      .limit(limit);

    query = applyFeedGate(query);
    query = query.or("is_sensitive.eq.false,is_sensitive.is.null");
    query = applyFederatedPortalScopeToQuery(query, {
      portalId,
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess?.sourceIds || [],
    });
    return query;
  };

  const prefixResult = await buildQuery(`${escapedQuery}%`);

  if (prefixResult.error) {
    console.error("Search preview events prefix error:", prefixResult.error);
  }

  let mergedRows =
    ((prefixResult.data as unknown as EventPreviewRow[] | null) || []);
  if (normalizedQuery.length > 5 && mergedRows.length < limit) {
    const containsResult = await buildQuery(`%${escapedQuery}%`);
    if (containsResult.error) {
      console.error("Search preview events contains error:", containsResult.error);
    } else {
      mergedRows = [
        ...mergedRows,
        ...(((containsResult.data as unknown as EventPreviewRow[] | null) || [])),
      ];
    }
  }

  const uniqueRows = Array.from(new Map(mergedRows.map((row) => [row.id, row])).values());
  const sourceScopedRows = uniqueRows.filter((event) =>
    isEventCategoryAllowedForSourceAccess(
      sourceAccess,
      event.source_id,
      event.category_id,
    )
  );
  const cityFiltered = filterByPortalCity(sourceScopedRows, portalCity, {
    allowMissingCity: true,
  });

  return cityFiltered
    .sort((a, b) => {
      const scoreDiff =
        computePreviewScore(normalizedQuery, b.title, 300) -
        computePreviewScore(normalizedQuery, a.title, 300);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    })
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      type: "event" as const,
      title: event.title,
      subtitle: event.venue?.name || undefined,
      href: `/event/${event.id}`,
      score: computePreviewScore(normalizedQuery, event.title, 300),
      metadata: {
        date: event.start_date,
        neighborhood: event.venue?.neighborhood || undefined,
        category: event.category_id || undefined,
      },
    }));
}

async function previewVenues(
  supabase: SupabaseClient,
  normalizedQuery: string,
  escapedQuery: string,
  limit: number,
  portalCity: string | undefined,
): Promise<SearchResult[]> {
  const sanitizedArrayQuery = normalizedQuery.replace(/[{},"\\/]/g, "");

  const buildQuery = (namePattern: string) => {
    let query = supabase
      .from("venues")
      .select("id, name, slug, address, neighborhood, city, aliases, venue_type, vibes")
      .or(
        `name.ilike.${namePattern},` +
          `address.ilike.%${escapedQuery}%,` +
          `aliases.cs.{${sanitizedArrayQuery}}`,
      )
      .order("name")
      .limit(limit);

    if (portalCity) {
      query = query.eq("city", portalCity);
    }

    return query;
  };

  const prefixResult = await buildQuery(`${escapedQuery}%`);

  if (prefixResult.error) {
    console.error("Search preview venues prefix error:", prefixResult.error);
  }

  let mergedRows = ((prefixResult.data as VenuePreviewRow[] | null) || []);
  if (normalizedQuery.length > 5 && mergedRows.length < limit) {
    const containsResult = await buildQuery(`%${escapedQuery}%`);
    if (containsResult.error) {
      console.error("Search preview venues contains error:", containsResult.error);
    } else {
      mergedRows = [
        ...mergedRows,
        ...(((containsResult.data as VenuePreviewRow[] | null) || [])),
      ];
    }
  }

  return Array.from(new Map(mergedRows.map((row) => [row.id, row])).values())
    .sort((a, b) => {
      const scoreDiff =
        computePreviewScore(normalizedQuery, b.name, 200) -
        computePreviewScore(normalizedQuery, a.name, 200);
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((venue) => ({
      id: venue.id,
      type: "venue" as const,
      title: venue.name,
      subtitle: venue.neighborhood || venue.city || undefined,
      href: `/venue/${venue.slug}`,
      score: computePreviewScore(normalizedQuery, venue.name, 200),
      metadata: {
        neighborhood: venue.neighborhood || undefined,
        venueType: venue.venue_type || undefined,
        vibes: venue.vibes || undefined,
      },
    }));
}

async function previewOrganizations(
  supabase: SupabaseClient,
  normalizedQuery: string,
  escapedQuery: string,
  limit: number,
  portalId: string | null,
  portalSlug: string | null,
): Promise<SearchResult[]> {
  let resolvedPortalId = portalId;
  if (!resolvedPortalId && portalSlug) {
    const { data: portalData } = await supabase
      .from("portals")
      .select("id")
      .eq("slug", portalSlug)
      .maybeSingle();
    resolvedPortalId = (portalData as { id: string } | null)?.id || null;
  }

  let portalOrgIds: string[] | null = null;
  if (resolvedPortalId) {
    const portalClient = supabase as unknown as SupabaseClient<OrganizationPortalSchema>;
    const { data: memberships, error: membershipError } = await portalClient
      .from("organization_portals")
      .select("organization_id")
      .eq("portal_id", resolvedPortalId);

    if (membershipError) {
      portalOrgIds = null;
    } else {
      portalOrgIds = (memberships || []).map(
        (row: { organization_id: string }) => row.organization_id,
      );
      if (portalOrgIds.length === 0) {
        return [];
      }
    }
  }

  const buildQuery = (pattern: string) => {
    let query = supabase
      .from("organizations")
      .select(
        "id, name, slug, org_type, neighborhood, featured, total_events_tracked, is_verified, hidden",
      )
      .ilike("name", pattern)
      .eq("hidden", false)
      .order("featured", { ascending: false })
      .order("total_events_tracked", { ascending: false, nullsFirst: false })
      .limit(limit)
      .or("is_verified.eq.true,is_verified.is.null");

    if (resolvedPortalId && portalOrgIds === null) {
      query = query.eq("portal_id", resolvedPortalId);
    } else if (portalOrgIds && portalOrgIds.length > 0) {
      query = query.in("id", portalOrgIds);
    }

    return query;
  };

  const prefixResult = await buildQuery(`${escapedQuery}%`);

  if (prefixResult.error) {
    console.error("Search preview organizations prefix error:", prefixResult.error);
  }

  let mergedRows = ((prefixResult.data as OrganizationPreviewRow[] | null) || []);
  if (normalizedQuery.length > 5 && mergedRows.length < limit) {
    const containsResult = await buildQuery(`%${escapedQuery}%`);
    if (containsResult.error) {
      console.error("Search preview organizations contains error:", containsResult.error);
    } else {
      mergedRows = [
        ...mergedRows,
        ...(((containsResult.data as OrganizationPreviewRow[] | null) || [])),
      ];
    }
  }

  return Array.from(new Map(mergedRows.map((row) => [row.id, row])).values())
    .sort((a, b) => {
      const scoreDiff =
        computePreviewScore(normalizedQuery, b.name, 100) -
        computePreviewScore(normalizedQuery, a.name, 100);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.total_events_tracked || 0) - (a.total_events_tracked || 0);
    })
    .slice(0, limit)
    .map((org) => ({
      id: org.id,
      type: "organizer" as const,
      title: org.name,
      subtitle: org.org_type || org.neighborhood || undefined,
      href: `/organizer/${org.slug}`,
      score: computePreviewScore(normalizedQuery, org.name, 100),
      metadata: {
        orgType: org.org_type || undefined,
        neighborhood: org.neighborhood || undefined,
        eventCount: org.total_events_tracked || undefined,
      },
    }));
}

export async function runSearchPreview(options: {
  supabase?: SupabaseClient;
  getSupabase?: () => Promise<SupabaseClient>;
  query: string;
  limit: number;
  requestedTypes: PreviewSearchType[];
  portalId: string | null;
  portalSlug: string | null;
  portalCity?: string;
  findType?: FindType | null;
  timing?: TimingRecorder;
}): Promise<UnifiedSearchResponse> {
  const {
    supabase,
    getSupabase,
    query,
    limit,
    requestedTypes,
    portalId,
    portalSlug,
    portalCity,
    findType,
    timing,
  } = options;
  const escapedQuery = escapeSQLPattern(query.toLowerCase().trim());
  const normalizedQuery = query.toLowerCase().trim();
  const measure = <T>(name: string, fn: () => Promise<T> | T) =>
    timing ? timing.measure(name, fn) : Promise.resolve(fn());

  const suggestionFastPathEligible = requestedTypes.every(
    (type) => type === "event" || type === "venue",
  );
  if (suggestionFastPathEligible && normalizedQuery.length <= 24) {
    const suggestionRows = await measure("preview_suggestions", () =>
      getSearchSuggestionsWithFallback(normalizedQuery, limit, portalCity),
    );
    const shouldUseSuggestions =
      suggestionRows.length > 0 &&
      (
        normalizedQuery.length <= 5 ||
        /\s/.test(normalizedQuery) ||
        suggestionRows.length >= Math.min(4, limit)
      );
    if (shouldUseSuggestions) {
      return buildPreviewResponse(
        suggestionRows
          .map((suggestion) =>
            mapSuggestionToSearchResult(
              suggestion,
              portalSlug || "atlanta",
              "preview",
              { findType },
            ),
          )
          .filter((result): result is SearchResult => result !== null),
      );
    }

    if (/\s/.test(normalizedQuery) && normalizedQuery.length >= 8) {
      return measure("preview_query_fallback", () =>
        buildPreviewResponse(
          buildDirectQueryFallbackResults(
            query.trim(),
            portalSlug || "atlanta",
            requestedTypes,
            findType,
          ),
        ),
      );
    }
  }

  const resolvedSupabase =
    supabase || (getSupabase ? await getSupabase() : null);
  if (!resolvedSupabase) {
    throw new Error("Search preview requires a Supabase client for live queries");
  }

  const sourceAccess =
    portalId && requestedTypes.includes("event")
      ? await measure("preview_source_access", () => getPortalSourceAccess(portalId))
      : null;

  const [eventResults, venueResults, organizerResults] = await Promise.all([
    requestedTypes.includes("event")
      ? measure("preview_events", () =>
          previewEvents(
            resolvedSupabase,
            normalizedQuery,
            escapedQuery,
            limit,
            portalId,
            sourceAccess,
            portalCity,
          ),
        )
      : Promise.resolve([]),
    requestedTypes.includes("venue")
      ? measure("preview_venues", () =>
          previewVenues(
            resolvedSupabase,
            normalizedQuery,
            escapedQuery,
            limit,
            portalCity,
          ),
        )
      : Promise.resolve([]),
    requestedTypes.includes("organizer")
      ? measure("preview_organizers", () =>
          previewOrganizations(
            resolvedSupabase,
            normalizedQuery,
            escapedQuery,
            Math.min(limit, 6),
            portalId,
            portalSlug,
          ),
        )
      : Promise.resolve([]),
  ]);

  return buildPreviewResponse([
    ...eventResults,
    ...venueResults,
    ...organizerResults,
  ]);
}
