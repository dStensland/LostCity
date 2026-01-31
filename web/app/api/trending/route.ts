import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request: Request) {
  // Rate limit: expensive endpoint with RSVP aggregation
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.expensive);
  if (rateLimitResult) return rateLimitResult;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "6", 10), 20);
  const portalSlug = searchParams.get("portal");

  const today = getLocalDateString();
  const nextWeekDate = new Date();
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeek = getLocalDateString(nextWeekDate);

  // Get portal data if specified
  let portalId: string | null = null;
  let portalFilters: { categories?: string[] } = {};

  if (portalSlug) {
    const { data: portal } = await supabase
      .from("portals")
      .select("id, filters")
      .eq("slug", portalSlug)
      .eq("status", "active")
      .maybeSingle();

    const portalData = portal as { id: string; filters: typeof portalFilters } | null;
    if (portalData) {
      portalId = portalData.id;
      portalFilters = portalData.filters || {};
    }
  }

  try {
    // Build query for events happening this week
    let query = supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        is_free,
        price_min,
        category,
        image_url,
        portal_id,
        venue:venues(id, name, neighborhood, slug)
      `)
      .gte("start_date", today)
      .lte("start_date", nextWeek)
      .is("canonical_event_id", null) // Only show canonical events, not duplicates
      .order("start_date", { ascending: true })
      .limit(100);

    // Apply portal filter if specified
    if (portalId) {
      // Show portal-specific events + public events
      // Escape portalId to prevent PostgREST injection
      query = query.or(`portal_id.eq."${portalId.replace(/"/g, "")}",portal_id.is.null`);

      // Apply portal category filters
      if (portalFilters.categories?.length) {
        query = query.in("category", portalFilters.categories);
      }
    } else {
      // No portal - only show public events
      query = query.is("portal_id", null);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Error fetching trending events:", error);
      return NextResponse.json({ error: "Failed to fetch trending events" }, { status: 500 });
    }

    // Get event IDs for RSVP lookup (batch query instead of fetching ALL RSVPs)
    const eventIds = (events || []).map((e: { id: number }) => e.id);

    // Fetch RSVPs only for the events we're considering (not ALL events in database)
    const rsvpMap: Record<number, number> = {};
    if (eventIds.length > 0) {
      const { data: rsvpCounts } = await supabase
        .from("event_rsvps")
        .select("event_id")
        .in("event_id", eventIds)
        .in("status", ["going", "interested"]);

      // Count RSVPs per event
      for (const rsvp of (rsvpCounts || []) as { event_id: number }[]) {
        rsvpMap[rsvp.event_id] = (rsvpMap[rsvp.event_id] || 0) + 1;
      }
    }

    type EventWithRsvps = {
      id: number;
      title: string;
      start_date: string;
      start_time: string | null;
      is_all_day: boolean;
      is_free: boolean;
      price_min: number | null;
      category: string | null;
      image_url: string | null;
      venue: {
        id: number;
        name: string;
        neighborhood: string | null;
        slug: string | null;
      } | null;
      rsvp_count: number;
    };

    // Add RSVP counts and sort by popularity
    const eventsWithRsvps: EventWithRsvps[] = ((events || []) as Omit<EventWithRsvps, "rsvp_count">[])
      .map((event) => ({
        ...event,
        rsvp_count: rsvpMap[event.id] || 0,
      }))
      .sort((a, b) => b.rsvp_count - a.rsvp_count)
      .slice(0, limit);

    return NextResponse.json({
      events: eventsWithRsvps,
    }, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("Error in trending API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
