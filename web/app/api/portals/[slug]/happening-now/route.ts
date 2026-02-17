import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/api-utils";
import { isSpotOpen, DESTINATION_CATEGORIES } from "@/lib/spots";
import { logger } from "@/lib/logger";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// GET /api/portals/[slug]/happening-now - Get events happening right now
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;

  const countOnly = searchParams.get("countOnly") === "true";
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    // Get portal
    const portal = await getPortalBySlug(slug);
    if (!portal || !isValidUUID(portal.id)) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }
    const portalCity =
      portal.portal_type === "business"
        ? undefined
        : (
            portal.filters &&
            typeof portal.filters === "object" &&
            !Array.isArray(portal.filters) &&
            "city" in portal.filters &&
            typeof (portal.filters as { city?: unknown }).city === "string"
          )
        ? (portal.filters as { city: string }).city
        : undefined;

    // Get current time in local timezone
    const now = new Date();
    const today = getLocalDateString(now);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}:00`;

    // Build query for events happening now
    // An event is "happening now" if:
    // 1. It's today
    // 2. It has started (start_time <= now)
    // 3. It hasn't ended (end_time > now, or no end_time and within 3 hours of start)

    let query = supabase
      .from("events")
      .select(countOnly ? "*" : `
        id,
        title,
        start_date,
        start_time,
        end_time,
        is_all_day,
        category,
        tags,
        image_url,
        venue:venues(id, name, slug, neighborhood, city)
      `, { count: countOnly ? "exact" : undefined, head: countOnly })
      .eq("start_date", today)
      .eq("is_all_day", false)
      .not("start_time", "is", null)
      .lte("start_time", currentTimeStr);

    query = applyPortalScopeToQuery(query, {
      portalId: portal.id,
      portalExclusive: portal.portal_type === "business",
      publicOnlyWhenNoPortal: true,
    });

    // Order by start time
    if (!countOnly) {
      query = query.order("start_time", { ascending: true }).limit(limit);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error("Error fetching happening now events:", error);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    if (countOnly) {
      // Also count open spots for the banner
      const placeTypes = Object.keys(DESTINATION_CATEGORIES).flatMap(
        (key) => DESTINATION_CATEGORIES[key as keyof typeof DESTINATION_CATEGORIES]
      );
      const typeFilters = placeTypes.map((t) => `venue_type.eq.${t}`).join(",");

      type HoursData = Record<string, { open: string; close: string } | null>;
      type SpotRow = { id: number; hours: HoursData | null };

      const { data: spots } = await supabase
        .from("venues")
        .select("id, hours")
        .eq("active", true)
        .or(typeFilters) as { data: SpotRow[] | null };

      // Count spots that are currently open (only those with known hours)
      let openSpotCount = 0;
      for (const spot of spots || []) {
        if (!spot.hours) continue; // Skip spots with unknown hours
        try {
          const result = isSpotOpen(spot.hours, false);
          if (result.isOpen) openSpotCount++;
        } catch {
          // If hours parsing fails, skip this spot
        }
      }

      return NextResponse.json({
        count: (count || 0) + openSpotCount,
        eventCount: count || 0,
        spotCount: openSpotCount,
      });
    }

    // Filter events that haven't ended yet
    interface EventRow {
      start_time: string | null;
      end_time: string | null;
      tags?: string[] | null;
      venue?: { city?: string | null } | null;
      [key: string]: unknown;
    }
    const scopedByCity = filterByPortalCity(
      (data || []) as EventRow[],
      portalCity,
      { allowMissingCity: true }
    );
    const liveEvents = scopedByCity.filter((event: EventRow) => {
      if (!event.start_time) return false;

      // Parse start time
      const [startHour, startMinute] = event.start_time.split(":").map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const currentMinutes = currentHour * 60 + currentMinute;

      // If event has an end time, check if we're before it
      if (event.end_time) {
        const [endHour, endMinute] = event.end_time.split(":").map(Number);
        const endMinutes = endHour * 60 + endMinute;
        return currentMinutes < endMinutes;
      }

      // No end time - assume event lasts 3 hours
      const assumedEndMinutes = startMinutes + 180;
      return currentMinutes < assumedEndMinutes;
    });

    // Filter regular showtimes from happening now
    const filteredEvents = liveEvents.filter(
      (event: EventRow) => !event.tags?.includes("showtime")
    );

    return NextResponse.json(
      {
        events: filteredEvents,
        count: filteredEvents.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    logger.error("Error in happening-now GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
