import { getFilteredEventsWithSearch, getFilteredEventsWithCursor, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import { enrichEventsWithSocialProof } from "@/lib/social-proof";
import type { MoodId } from "@/lib/moods";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { generateNextCursor } from "@/lib/cursor";
import { logger } from "@/lib/logger";
import { apiResponse } from "@/lib/api-utils";
import { isSuppressedFromGeneralEventFeed } from "@/lib/event-content-classification";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Helper to safely parse integers with validation
function safeParseInt(value: string | null, defaultValue: number, min = 1, max = 1000): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: Request) {
  // Rate limit: read endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);

    // Parse price filter - same logic as page.tsx
    const priceParam = searchParams.get("price");
    const priceFilter = PRICE_FILTERS.find(p => p.value === priceParam);
    const isFree = priceParam === "free" || searchParams.get("free") === "1" || searchParams.get("free") === "true" || undefined;
    const priceMax = priceFilter?.max || undefined;

    // Parse venue_id with validation
    const venueParam = searchParams.get("venue");
    const venueId = venueParam ? safeParseInt(venueParam, 0, 0, 999999) : undefined;

    const portalExclusive = searchParams.get("portal_exclusive") === "true";

    // Resolve portal context to get portal_id and city filter
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request));
    const portalId = portalContext.portalId || searchParams.get("portal_id") || undefined;
    const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

    const dateParam = searchParams.get("date") || "";
    const dateSpecific = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;

    // Support explicit date range params (start_date + end_date) for break planner etc.
    // These take precedence over the single `date` param when both are provided.
    const dateRangeStart = searchParams.get("start_date") ?? undefined;
    const dateRangeEnd = searchParams.get("end_date") ?? undefined;
    const dateRangeActive = !!(dateRangeStart && dateRangeEnd);

    // Parse map bounds for viewport filtering
    const useMapBounds = searchParams.get("map_bounds") === "true";
    const swLat = searchParams.get("sw_lat");
    const swLng = searchParams.get("sw_lng");
    const neLat = searchParams.get("ne_lat");
    const neLng = searchParams.get("ne_lng");

    // Build geo bounds filter if all coords present
    let geoBounds: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number } | undefined;
    if (useMapBounds && swLat && swLng && neLat && neLng) {
      geoBounds = {
        sw_lat: parseFloat(swLat),
        sw_lng: parseFloat(swLng),
        ne_lat: parseFloat(neLat),
        ne_lng: parseFloat(neLng),
      };
    }

    const genres = searchParams.get("genres")?.split(",").filter(Boolean) || [];
    const VALID_IMPORTANCE = new Set(["flagship", "major", "standard"]);
    const importanceRaw = searchParams.get("importance")?.split(",").filter(Boolean) || undefined;
    const importance = importanceRaw?.filter((i) => VALID_IMPORTANCE.has(i));

    const filters: SearchFilters = {
      search: searchParams.get("search") || undefined,
      categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      genres: genres.length > 0 ? genres : undefined,
      vibes: searchParams.get("vibes")?.split(",").filter(Boolean) || undefined,
      neighborhoods: searchParams.get("neighborhoods")?.split(",").filter(Boolean) || undefined,
      is_free: isFree,
      price_max: priceMax,
      date_filter: dateRangeActive ? undefined : ((!dateParam || dateSpecific) ? undefined : (dateParam as SearchFilters["date_filter"])),
      date_range_start: dateRangeActive ? dateRangeStart : dateSpecific,
      date_range_end: dateRangeActive ? dateRangeEnd : dateSpecific,
      venue_id: venueId || undefined,
      mood: (searchParams.get("mood") as MoodId) || undefined,
      portal_id: portalId,
      portal_exclusive: portalExclusive,
      exclude_classes: true,
      geo_bounds: geoBounds,
      // portal_city scopes venue sub-queries (vibes, neighborhoods, search) to
      // the portal's city without adding .in("venue_id", [...]) to the main query
      // (which exceeds PostgREST URL limits for cities with 2500+ venues).
      portal_city: portalCity,
      importance: importance && importance.length > 0 ? importance : undefined,
    };

    const pageSize = safeParseInt(searchParams.get("pageSize"), 20, 1, 500);
    const cursor = searchParams.get("cursor");

    // Use cursor-based pagination if cursor provided, otherwise fall back to offset pagination
    if (cursor !== null || searchParams.get("useCursor") === "true") {
      // Cursor-based pagination (new, preferred method)
      const { events: rawEvents, nextCursor, hasMore } = await getFilteredEventsWithCursor(
        filters,
        cursor,
        pageSize
      );

      // Enrich with social proof counts
      const events = (await enrichEventsWithSocialProof(rawEvents)).filter(
        (event) => !isSuppressedFromGeneralEventFeed(event)
      );

      return apiResponse(
        {
          events,
          cursor: nextCursor,
          hasMore,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        }
      );
    } else {
      // Offset-based pagination (legacy, for backwards compatibility)
      const page = safeParseInt(searchParams.get("page"), 1, 1, 100);
      const { events: rawEvents, total } = await getFilteredEventsWithSearch(filters, page, pageSize);

      // Enrich with social proof counts
      const events = (await enrichEventsWithSocialProof(rawEvents)).filter(
        (event) => !isSuppressedFromGeneralEventFeed(event)
      );

      // Also generate a cursor from the last event for gradual migration
      const nextCursor = events.length > 0 ? generateNextCursor(events) : null;

      return apiResponse(
        {
          events,
          hasMore: page * pageSize < total,
          total,
          cursor: nextCursor, // Include cursor for clients that want to switch
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        }
      );
    }
  } catch (error) {
    logger.error("Events API error", error, { component: "events" });
    return apiResponse(
      { error: "Failed to fetch events", events: [], hasMore: false, total: 0 },
      { status: 500 }
    );
  }
}
