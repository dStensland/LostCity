import { getFilteredEventsWithCursor, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import { enrichEventsWithSocialProof } from "@/lib/social-proof";
import { deduplicateCinemaEvents } from "@/lib/cinema-filter";
import type { MoodId } from "@/lib/moods";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { apiResponse, escapeSQLPattern } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import type { Festival } from "@/lib/festivals";
import { logger } from "@/lib/logger";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import { filterByPortalCity } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

function safeParseInt(value: string | null, defaultValue: number, min = 1, max = 1000): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

type TimelinePayload = {
  events: Awaited<ReturnType<typeof enrichEventsWithSocialProof>>;
  festivals: Festival[];
  cursor: string | null;
  hasMore: boolean;
};

const TIMELINE_CACHE_NAMESPACE = "api:timeline";
const TIMELINE_CACHE_TTL_MS = 60 * 1000; // 60 seconds

function buildTimelineCacheKey(portalId: string | undefined, filters: SearchFilters): string {
  const parts = [
    portalId || "none",
    filters.search || "",
    filters.categories?.join(",") || "",
    filters.genres?.join(",") || "",
    filters.tags?.join(",") || "",
    filters.vibes?.join(",") || "",
    filters.neighborhoods?.join(",") || "",
    filters.is_free ? "free" : "",
    filters.price_max?.toString() || "",
    filters.date_filter || "",
    filters.venue_id?.toString() || "",
    filters.mood || "",
    filters.portal_exclusive ? "excl" : "",
  ];
  return parts.join("|");
}

async function fetchTimelinePage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: SearchFilters,
  portalId: string | undefined,
  portalCity: string | undefined,
  cursor: string | null,
  pageSize: number,
): Promise<TimelinePayload> {
  // PERFORMANCE: Fetch events and festivals in parallel.
  // Skip festivals when event-specific filters are active that festivals
  // can't match (tags, vibes, venue) — showing unfiltered festivals alongside
  // filtered events is confusing.
  const hasEventOnlyFilters = !!(
    filters.tags?.length ||
    filters.vibes?.length ||
    filters.venue_id
  );
  const today = getLocalDateString(new Date());

  const [eventsResult, festivalsResult] = await Promise.all([
    // Fetch events with cursor pagination
    getFilteredEventsWithCursor(filters, cursor, pageSize),

    // Fetch festivals (if applicable)
    hasEventOnlyFilters
      ? Promise.resolve({ data: [], error: null })
      : (async () => {
          let festivalQuery = supabase
            .from("festivals")
            .select("id, name, slug, website, location, neighborhood, categories, free, announced_start, announced_end, ticket_url, description, image_url, typical_month, typical_duration_days, festival_type, portal_id")
            .not("announced_start", "is", null)
            .not("festival_type", "in", "(conference,trade_show,professional_development,convention)");

          // Apply a default future range filter
          festivalQuery = festivalQuery.or(`announced_end.gte.${today},announced_end.is.null`);

          // Apply portal filter
          if (portalId) {
            festivalQuery = festivalQuery.eq("portal_id", portalId);
          }

          // Apply search filter
          if (filters.search) {
            const escapedSearch = escapeSQLPattern(filters.search);
            festivalQuery = festivalQuery.ilike("name", `%${escapedSearch}%`);
          }

          // Apply category filter
          if (filters.categories && filters.categories.length > 0) {
            festivalQuery = festivalQuery.overlaps("categories", filters.categories);
          }

          // Apply price filter
          if (filters.is_free) {
            festivalQuery = festivalQuery.eq("free", true);
          }

          // Apply neighborhood filter
          if (filters.neighborhoods && filters.neighborhoods.length > 0) {
            festivalQuery = festivalQuery.in("neighborhood", filters.neighborhoods);
          }

          // Apply date filter
          if (filters.date_filter) {
            if (filters.date_filter === "today") {
              festivalQuery = festivalQuery
                .lte("announced_start", today)
                .gte("announced_end", today);
            }
          }

          festivalQuery = festivalQuery
            .order("announced_start", { ascending: true })
            .limit(50);

          return festivalQuery;
        })(),
  ]);

  const { events: rawEvents, nextCursor, hasMore } = eventsResult;

  // Filter events by portal city (in-memory, avoids header overflow from venue ID pre-fetching)
  const cityFilteredEvents = filterByPortalCity(rawEvents, portalCity, { allowMissingCity: true });

  // Enrich events with social proof
  const enrichedEvents = await enrichEventsWithSocialProof(cityFilteredEvents);

  // Collapse cinema showtimes: one feed card per film per day
  const events = deduplicateCinemaEvents(enrichedEvents) as typeof enrichedEvents;

  let festivals: Festival[] = [];
  let festivalError: { message: string } | null = null;

  if (!hasEventOnlyFilters) {
    const { data: festivalsData, error } = festivalsResult;

    // Filter festivals based on actual event date range if we have events
    if (festivalsData && hasMore && events.length > 0) {
      const lastEventDate = events[events.length - 1].start_date;
      festivals = (festivalsData as Festival[]).filter(f => {
        return (
          (f.announced_start && f.announced_start >= today && f.announced_start <= lastEventDate) ||
          (f.announced_start && f.announced_start <= today && f.announced_end && f.announced_end >= today)
        );
      });
    } else {
      festivals = (festivalsData || []) as Festival[];
    }

    // Cross-table dedup: drop festivals whose name normalizes to a substring of (or matches)
    // an event title already in this page, avoiding duplicates when a festival appears both
    // as a crawled event and as a festivals-table record.
    if (festivals.length > 0 && events.length > 0) {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const eventTitleNorms = new Set(events.map(e => normalize(e.title)));
      festivals = festivals.filter(f => {
        const normName = normalize(f.name);
        return !eventTitleNorms.has(normName) &&
          ![...eventTitleNorms].some(en => en.includes(normName) || normName.includes(en));
      });
    }

    festivalError = error;
  }

  if (festivalError) {
    logger.error("Error fetching festivals for timeline", { error: festivalError.message });
    // Return events without festivals rather than failing entirely
    return {
      events,
      festivals: [] as Festival[],
      cursor: nextCursor,
      hasMore,
    };
  }

  return {
    events,
    festivals: festivals || [],
    cursor: nextCursor,
    hasMore,
  };
}

export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request), { bucket: "timeline" });
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const priceParam = searchParams.get("price");
    const priceFilter = PRICE_FILTERS.find(p => p.value === priceParam);
    const isFree = priceParam === "free" || searchParams.get("free") === "1" || undefined;
    const priceMax = priceFilter?.max || undefined;
    const venueParam = searchParams.get("venue");
    const venueId = venueParam ? safeParseInt(venueParam, 0, 0, 999999) : undefined;
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request));
    if (portalContext.hasPortalParamMismatch) {
      return apiResponse(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }
    const portalId = portalContext.portalId || undefined;
    const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;
    const portalExclusive = searchParams.get("portal_exclusive") === "true";
    const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

    const filters: SearchFilters = {
      search: searchParams.get("search") || undefined,
      categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
      genres: searchParams.get("genres")?.split(",").filter(Boolean) || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      vibes: searchParams.get("vibes")?.split(",").filter(Boolean) || undefined,
      neighborhoods: searchParams.get("neighborhoods")?.split(",").filter(Boolean) || undefined,
      is_free: isFree,
      price_max: priceMax,
      date_filter: (searchParams.get("date") as "today" | "weekend" | "week") || undefined,
      venue_id: venueId || undefined,
      mood: (searchParams.get("mood") as MoodId) || undefined,
      portal_id: portalId,
      portal_exclusive: portalExclusive,
      source_ids: sourceAccess?.sourceIds.length ? sourceAccess.sourceIds : undefined,
      exclude_classes: true,
    };

    const pageSize = 20;
    const cursor = searchParams.get("cursor");

    // For first-page requests (no cursor), use shared cache to avoid repeat cold fetches.
    // Paginated requests vary too much per cursor value and are far less common.
    if (!cursor) {
      const cacheKey = buildTimelineCacheKey(portalId, filters);

      const payload = await getOrSetSharedCacheJson<TimelinePayload>(
        TIMELINE_CACHE_NAMESPACE,
        cacheKey,
        TIMELINE_CACHE_TTL_MS,
        async () => {
          return fetchTimelinePage(supabase, filters, portalId, portalCity, null, pageSize);
        },
        { maxEntries: 100 },
      );

      return apiResponse(payload, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    // Cursor requests fall through to direct fetch (no cache).
    const cursorPayload = await fetchTimelinePage(supabase, filters, portalId, portalCity, cursor, pageSize);
    return apiResponse(cursorPayload, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });

  } catch (error) {
    logger.error("Error in timeline API", {
      error: error instanceof Error ? error.message : String(error)
    });
    return apiResponse(
      { error: "Failed to fetch timeline data" },
      { status: 500 }
    );
  }
}
