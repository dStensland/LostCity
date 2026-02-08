import { getFilteredEventsWithCursor, enrichEventsWithSocialProof, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import type { MoodId } from "@/lib/moods";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { apiResponse, escapeSQLPattern } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import type { Festival } from "@/lib/festivals";
import { logger } from "@/lib/logger";

function safeParseInt(value: string | null, defaultValue: number, min = 1, max = 1000): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const priceParam = searchParams.get("price");
    const priceFilter = PRICE_FILTERS.find(p => p.value === priceParam);
    const isFree = priceParam === "free" || undefined;
    const priceMax = priceFilter?.max || undefined;
    const venueParam = searchParams.get("venue");
    const venueId = venueParam ? safeParseInt(venueParam, 0, 0, 999999) : undefined;
    const portalId = searchParams.get("portal_id") || undefined;
    const portalExclusive = searchParams.get("portal_exclusive") === "true";

    const filters: SearchFilters = {
      search: searchParams.get("search") || undefined,
      categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
      subcategories: searchParams.get("subcategories")?.split(",").filter(Boolean) || undefined,
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
      exclude_classes: true,
    };

    const pageSize = 20;
    const cursor = searchParams.get("cursor");

    // Get events with cursor pagination
    const { events: rawEvents, nextCursor, hasMore } = await getFilteredEventsWithCursor(
      filters, cursor, pageSize
    );
    const events = await enrichEventsWithSocialProof(rawEvents);

    // Fetch festivals based on event date range.
    // Skip festivals when event-specific filters are active that festivals
    // can't match (tags, vibes, subcategories, venue) — showing unfiltered
    // festivals alongside filtered events is confusing.
    const hasEventOnlyFilters = !!(
      filters.tags?.length ||
      filters.vibes?.length ||
      filters.subcategories?.length ||
      filters.venue_id
    );

    let festivals: Festival[] = [];
    let festivalError: { message: string } | null = null;

    if (!hasEventOnlyFilters) {
      const supabase = await createClient();
      const today = getLocalDateString(new Date());

      let festivalQuery = supabase
        .from("festivals")
        .select("id, name, slug, website, location, neighborhood, categories, free, announced_start, announced_end, ticket_url, description, image_url, typical_month, typical_duration_days, festival_type, portal_id")
        .not("announced_start", "is", null);

      // Determine date range for festivals
      if (hasMore && events.length > 0) {
        // Only fetch festivals up to the last event's date, plus currently happening festivals
        const lastEventDate = events[events.length - 1].start_date;
        festivalQuery = festivalQuery.or(
          `and(announced_start.gte.${today},announced_start.lte.${lastEventDate}),` +
          `and(announced_start.lte.${today},announced_end.gte.${today})`
        );
      } else {
        // Fetch all future festivals
        festivalQuery = festivalQuery.or(`announced_end.gte.${today},announced_end.is.null`);
      }

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
        const today = getLocalDateString(new Date());
        if (filters.date_filter === "today") {
          festivalQuery = festivalQuery
            .lte("announced_start", today)
            .gte("announced_end", today);
        }
      }

      festivalQuery = festivalQuery
        .order("announced_start", { ascending: true })
        .limit(50);

      const result = await festivalQuery;
      festivals = result.data || [];
      festivalError = result.error;
    }

    if (festivalError) {
      logger.error("Error fetching festivals for timeline", { error: festivalError.message });
      // Return events without festivals rather than failing entirely
      return apiResponse({
        events,
        festivals: [] as Festival[],
        cursor: nextCursor,
        hasMore,
      }, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    return apiResponse({
      events,
      festivals: festivals || [],
      cursor: nextCursor,
      hasMore,
    }, {
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
