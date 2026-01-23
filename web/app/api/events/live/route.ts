import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type LiveEventRow = {
  id: number;
  title: string;
  start_time: string;
  end_time: string | null;
  is_all_day: boolean;
  category: string | null;
  subcategory: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  ticket_url: string | null;
  is_live: boolean;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
    spot_type: string | null;
  } | null;
};

export async function GET(request: Request) {
  // Rate limit: read endpoint
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // Get all currently live events with venue info
    const { data, error } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_time,
        end_time,
        is_all_day,
        category,
        subcategory,
        price_min,
        price_max,
        is_free,
        ticket_url,
        is_live,
        venue:venues!events_venue_id_fkey(
          id,
          name,
          neighborhood,
          lat,
          lng,
          spot_type
        )
      `)
      .eq("is_live", true)
      .is("canonical_event_id", null) // Only show canonical events, not duplicates
      .order("start_time", { ascending: true });

    if (error) {
      throw error;
    }

    const events = data as LiveEventRow[] | null;

    // Get RSVP counts for live events
    const eventIds = events?.map((e) => e.id) || [];
    let goingCounts: Record<number, number> = {};

    if (eventIds.length > 0) {
      const { data: rsvpData } = await supabase
        .from("event_rsvps")
        .select("event_id")
        .in("event_id", eventIds)
        .eq("status", "going");

      const rsvps = rsvpData as { event_id: number }[] | null;
      if (rsvps) {
        goingCounts = rsvps.reduce((acc, rsvp) => {
          acc[rsvp.event_id] = (acc[rsvp.event_id] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
      }
    }

    // Enrich events with counts
    const enrichedEvents = (events || []).map((event) => ({
      ...event,
      going_count: goingCounts[event.id] || 0,
    }));

    return Response.json(
      {
        events: enrichedEvents,
        count: enrichedEvents.length,
      },
      {
        headers: {
          // Live events change frequently - short cache
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Live events API error:", error);
    return Response.json(
      { error: "Failed to fetch live events", events: [], count: 0 },
      { status: 500 }
    );
  }
}
