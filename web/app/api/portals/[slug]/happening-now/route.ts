import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { getLocalDateString } from "@/lib/formats";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// GET /api/portals/[slug]/happening-now - Get events happening right now
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;

  const countOnly = searchParams.get("countOnly") === "true";
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    // Get portal
    const portal = await getPortalBySlug(slug);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

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
        image_url,
        venue:venues(id, name, slug, neighborhood)
      `, { count: countOnly ? "exact" : undefined, head: countOnly })
      .eq("start_date", today)
      .eq("is_all_day", false)
      .not("start_time", "is", null)
      .lte("start_time", currentTimeStr);

    // Filter by portal if not the default portal
    if (portal.portal_type === "business") {
      query = query.eq("portal_id", portal.id);
    }

    // Order by start time
    if (!countOnly) {
      query = query.order("start_time", { ascending: true }).limit(limit);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Error fetching happening now events:", error);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    if (countOnly) {
      return NextResponse.json({ count: count || 0 });
    }

    // Filter events that haven't ended yet
    interface EventRow {
      start_time: string | null;
      end_time: string | null;
      [key: string]: unknown;
    }
    const liveEvents = (data || []).filter((event: EventRow) => {
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

    return NextResponse.json({
      events: liveEvents,
      count: liveEvents.length,
    });
  } catch (error) {
    console.error("Error in happening-now GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
