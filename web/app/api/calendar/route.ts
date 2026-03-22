import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { parseIntParam } from "@/lib/api-utils";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import {
  applyFederatedPortalScopeToQuery,
  excludeSensitiveEvents,
  filterByPortalCity,
} from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { getPortalSourceAccess } from "@/lib/federation";

const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches CDN s-maxage=300
const CALENDAR_CACHE_MAX_ENTRIES = 200;
const CALENDAR_CACHE_NAMESPACE = "api:calendar";

/**
 * Calendar API - Optimized endpoint for calendar view
 *
 * Returns events grouped by date for a given month, ignoring date filters
 * but respecting other filters (categories, price, location, portal).
 *
 * Query params:
 * - month: Month number (1-12), defaults to current month
 * - year: Year (YYYY), defaults to current year
 * - categories: Comma-separated category IDs
 * - neighborhoods: Comma-separated neighborhood names
 * - price: Price filter (free, budget, moderate, premium)
 * - portal_id: Portal ID for filtering (required for portal views)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Rate limit: expensive endpoint with pagination
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.expensive, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;

  // Parse month/year - default to current
  const now = new Date();
  const month = parseIntParam(searchParams.get("month"), now.getMonth() + 1);
  const year = parseIntParam(searchParams.get("year"), now.getFullYear());

  // Validate month and year ranges
  if (month === null || month < 1 || month > 12) {
    logger.error("Invalid month parameter", { month: searchParams.get("month") }, { component: "calendar" });
    return NextResponse.json({ error: "Invalid month parameter" }, { status: 400 });
  }

  if (year === null || year < 1900 || year > 2100) {
    logger.error("Invalid year parameter", { year: searchParams.get("year") }, { component: "calendar" });
    return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
  }

  // Calculate date range (include buffer for week view)
  const targetDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  const rangeStart = startOfWeek(monthStart);
  const rangeEnd = endOfWeek(monthEnd);

  const startDate = format(rangeStart, "yyyy-MM-dd");
  const endDate = format(rangeEnd, "yyyy-MM-dd");

  // Parse filters (excluding date filters)
  const categories = searchParams.get("categories")?.split(",").filter(Boolean);
  const neighborhoods = searchParams.get("neighborhoods")?.split(",").filter(Boolean);
  const genres = searchParams.get("genres")?.split(",").filter(Boolean);
  const priceFilter = searchParams.get("price");
  const portalExclusive = searchParams.get("portal_exclusive") === "true";
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return NextResponse.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 }
    );
  }
  const portalId = portalContext.portalId;
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

  // Type for calendar events (flat — no FK joins for query performance)
  type CalendarEventRow = {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    category: string | null;
    is_free: boolean;
    price_min: number | null;
    price_max: number | null;
    tags?: string[] | null;
    image_url: string | null;
    blurhash: string | null;
    is_tentpole: boolean;
    featured_blurb: string | null;
    venue_id: number | null;
  };

  type VenueRow = {
    id: number;
    name: string;
    neighborhood: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };

  // Helper to build base query with filters (no FK joins — they cause timeouts on large portals)
  const buildQuery = () => {
    let query = supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        category:category_id,
        is_free,
        price_min,
        price_max,
        tags,
        image_url,
        blurhash,
        is_tentpole,
        featured_blurb,
        venue_id
      `)
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .is("canonical_event_id", null) // Only show canonical events, not duplicates
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true });

    // Apply category filter
    if (categories && categories.length > 0) {
      query = query.in("category_id", categories);
    }

    // Neighborhood filter applied post-query via venue lookup (no FK join for performance)

    // Apply genre filter (series-level genres stored on events via tags or series join)
    if (genres && genres.length > 0) {
      query = query.overlaps("tags", genres);
    }

    // Apply price filter
    if (priceFilter === "free") {
      query = query.eq("is_free", true);
    } else if (priceFilter === "budget") {
      query = query.or("is_free.eq.true,price_max.lte.25");
    } else if (priceFilter === "moderate") {
      query = query.gte("price_min", 25).lte("price_max", 75);
    } else if (priceFilter === "premium") {
      query = query.gte("price_min", 75);
    }

    query = applyFeedGate(query);

    query = applyFederatedPortalScopeToQuery(query, {
      portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess?.sourceIds ?? [],
    });

    query = excludeSensitiveEvents(query);

    return query;
  };

  const cacheKey = [
    portalId ?? "null",
    month,
    year,
    categories?.join(",") ?? "",
    neighborhoods?.join(",") ?? "",
    genres?.join(",") ?? "",
    priceFilter ?? "",
    portalExclusive ? "exclusive" : "inclusive",
  ].join("|");

  type CalendarPayload = {
    month: number;
    year: number;
    range: { start: string; end: string };
    eventsByDate: Record<string, unknown[]>;
    summary: { totalEvents: number; daysWithEvents: number; categoryCounts: Record<string, number> };
  };

  let payload: CalendarPayload;
  try {
    payload = await getOrSetSharedCacheJson<CalendarPayload>(
      CALENDAR_CACHE_NAMESPACE,
      cacheKey,
      CALENDAR_CACHE_TTL_MS,
      async (): Promise<CalendarPayload> => {
        // Fetch all events using pagination (Supabase has 1000 row limit)
        const PAGE_SIZE = 1000;
        const allEvents: CalendarEventRow[] = [];
        const seenIds = new Set<number>();
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;

          const { data, error: pageError } = await buildQuery().range(from, to);

          if (pageError) {
            logger.error("Calendar query error", pageError);
            throw new Error(pageError.message);
          }

          const pageEvents = (data || []) as CalendarEventRow[];

          // Deduplicate as we go
          for (const event of pageEvents) {
            if (!seenIds.has(event.id)) {
              seenIds.add(event.id);
              allEvents.push(event);
            }
          }

          // If we got fewer than PAGE_SIZE results, we've reached the end
          hasMore = pageEvents.length === PAGE_SIZE;
          page++;

          // Safety limit to prevent infinite loops
          if (page > 10) break;
        }

        // Batch-fetch venue data for all unique venue IDs
        const venueIds = [...new Set(allEvents.map(e => e.venue_id).filter((id): id is number => id !== null))];
        const venueMap = new Map<number, VenueRow>();
        if (venueIds.length > 0) {
          // Fetch in chunks of 500 to stay under Supabase URL length limits
          for (let i = 0; i < venueIds.length; i += 500) {
            const chunk = venueIds.slice(i, i + 500);
            const { data: venues } = await supabase
              .from("venues")
              .select("id, name, neighborhood, city, lat, lng")
              .in("id", chunk);
            if (venues) {
              for (const v of venues as VenueRow[]) {
                venueMap.set(v.id, v);
              }
            }
          }
        }

        // Merge venue data onto events, dropping venue_id from response
        type CalendarEvent = Omit<CalendarEventRow, "venue_id"> & {
          venue: { id: number; name: string; neighborhood: string | null; city: string | null; lat: number | null; lng: number | null } | null;
        };
        const eventsWithVenues: CalendarEvent[] = allEvents.map(({ venue_id, ...event }) => {
          const venue = venue_id ? venueMap.get(venue_id) ?? null : null;
          return { ...event, venue };
        });

        // Apply portal city filter using venue city data
        const cityFiltered = filterByPortalCity(eventsWithVenues, portalCity, {
          allowMissingCity: true,
        });

        // Apply neighborhood filter post-query
        const events = (neighborhoods && neighborhoods.length > 0)
          ? cityFiltered.filter(e => e.venue?.neighborhood && neighborhoods.includes(e.venue.neighborhood))
          : cityFiltered;

        // Group events by date
        const eventsByDate: Record<string, CalendarEvent[]> = {};
        const categoryCounts: Record<string, number> = {};

        events.forEach((event) => {
          const dateKey = event.start_date;
          if (!eventsByDate[dateKey]) {
            eventsByDate[dateKey] = [];
          }
          eventsByDate[dateKey].push(event);

          // Track category counts
          if (event.category) {
            categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
          }
        });

        // Calculate summary stats
        const totalEvents = events.length;
        const daysWithEvents = Object.keys(eventsByDate).length;

        return {
          month,
          year,
          range: { start: startDate, end: endDate },
          eventsByDate,
          summary: {
            totalEvents,
            daysWithEvents,
            categoryCounts,
          },
        };
      },
      { maxEntries: CALENDAR_CACHE_MAX_ENTRIES }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(payload, {
    headers: {
      // Cache for 5 minutes, stale-while-revalidate for 1 hour
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
