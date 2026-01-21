import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "6", 10), 20);

  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    // Get events with RSVP counts for the next week
    const { data: rsvpCounts } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .in("status", ["going", "interested"]);

    // Count RSVPs per event
    const rsvpMap: Record<number, number> = {};
    for (const rsvp of (rsvpCounts || []) as { event_id: number }[]) {
      rsvpMap[rsvp.event_id] = (rsvpMap[rsvp.event_id] || 0) + 1;
    }

    // Get events happening this week
    const { data: events, error } = await supabase
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
        venue:venues(id, name, neighborhood, slug)
      `)
      .gte("start_date", today)
      .lte("start_date", nextWeek)
      .order("start_date", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error fetching trending events:", error);
      return NextResponse.json({ error: "Failed to fetch trending events" }, { status: 500 });
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
