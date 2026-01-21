import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";

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
 * - portal_id: Portal ID for filtering
 * - portal_exclusive: If true, only show portal's own events
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse month/year - default to current
  const now = new Date();
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

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
  const priceFilter = searchParams.get("price");
  const portalId = searchParams.get("portal_id");
  const portalExclusive = searchParams.get("portal_exclusive") === "true";

  // Type for calendar events (minimal fields)
  type CalendarEvent = {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    category: string | null;
    is_free: boolean;
    price_min: number | null;
    price_max: number | null;
    venue: { name: string; neighborhood: string | null } | null;
  };

  // Helper to build base query with filters
  const buildQuery = () => {
    let query = supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        category,
        is_free,
        price_min,
        price_max,
        venue:venues!events_venue_id_fkey (
          name,
          neighborhood
        )
      `)
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true });

    // Apply category filter
    if (categories && categories.length > 0) {
      query = query.in("category", categories);
    }

    // Apply neighborhood filter via venue
    if (neighborhoods && neighborhoods.length > 0) {
      query = query.in("venue.neighborhood", neighborhoods);
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

    // Apply portal filter
    if (portalExclusive && portalId) {
      query = query.eq("portal_id", portalId);
    } else if (portalId) {
      query = query.or(`portal_id.is.null,portal_id.eq.${portalId}`);
    }

    return query;
  };

  // Fetch all events using pagination (Supabase has 1000 row limit)
  const PAGE_SIZE = 1000;
  const allEvents: CalendarEvent[] = [];
  const seenIds = new Set<number>();
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error: pageError } = await buildQuery().range(from, to);

    if (pageError) {
      console.error("Calendar query error:", pageError);
      return NextResponse.json({ error: pageError.message }, { status: 500 });
    }

    const pageEvents = (data || []) as CalendarEvent[];

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

  const events = allEvents;

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
  const totalEvents = events?.length || 0;
  const daysWithEvents = Object.keys(eventsByDate).length;

  return NextResponse.json({
    month,
    year,
    range: { start: startDate, end: endDate },
    eventsByDate,
    summary: {
      totalEvents,
      daysWithEvents,
      categoryCounts,
    },
  }, {
    headers: {
      // Cache for 5 minutes, stale-while-revalidate for 1 hour
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
