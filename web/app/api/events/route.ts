import { getFilteredEventsWithSearch, getFilteredEventsWithCursor, enrichEventsWithSocialProof, PRICE_FILTERS, type SearchFilters } from "@/lib/search";
import type { MoodId } from "@/lib/moods";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { generateNextCursor } from "@/lib/cursor";
import { logger } from "@/lib/logger";
import { apiResponse } from "@/lib/api-utils";
import { isSuppressedFromGeneralEventFeed } from "@/lib/event-content-classification";

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

    const portalId = searchParams.get("portal_id") || undefined;
    const portalExclusive = searchParams.get("portal_exclusive") === "true";
    const includeExhibits = ["1", "true"].includes(
      (searchParams.get("include_exhibits") || "").toLowerCase()
    );

    const dateParam = searchParams.get("date") || "";
    const dateSpecific = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;

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

    const subcategories = searchParams.get("subcategories")?.split(",").filter(Boolean) || [];
    const subcategoryGenres = subcategories
      .map((sub) => sub.includes(".") ? sub.split(".").slice(1).join(".") : sub)
      .filter(Boolean);
    const genres = searchParams.get("genres")?.split(",").filter(Boolean) || [];
    const mergedGenres = Array.from(new Set([...genres, ...subcategoryGenres]));

    const filters: SearchFilters = {
      search: searchParams.get("search") || undefined,
      categories: searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      genres: mergedGenres.length > 0 ? mergedGenres : undefined,
      vibes: searchParams.get("vibes")?.split(",").filter(Boolean) || undefined,
      neighborhoods: searchParams.get("neighborhoods")?.split(",").filter(Boolean) || undefined,
      is_free: isFree,
      price_max: priceMax,
      date_filter: (!dateParam || dateSpecific) ? undefined : (dateParam as SearchFilters["date_filter"]),
      date_range_start: dateSpecific,
      date_range_end: dateSpecific,
      venue_id: venueId || undefined,
      mood: (searchParams.get("mood") as MoodId) || undefined,
      portal_id: portalId,
      portal_exclusive: portalExclusive,
      exclude_classes: true,
      geo_bounds: geoBounds,
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
        (event) => includeExhibits || !isSuppressedFromGeneralEventFeed(event)
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
        (event) => includeExhibits || !isSuppressedFromGeneralEventFeed(event)
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
