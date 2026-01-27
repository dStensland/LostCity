import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventId = parseInt(id, 10);

  if (isNaN(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch event with venue, producer, and series
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, vibes, description, lat, lng),
      producer:event_producers(id, name, slug, org_type, website, instagram, logo_url, description),
      series:event_series(id, title, slug, series_type, description)
    `)
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Cast to access properties
  const eventData = event as {
    venue_id?: number;
    venue?: { id: number; neighborhood?: string | null };
    start_date: string;
    start_time?: string | null;
    end_time?: string | null;
    [key: string]: unknown;
  };

  // Get today's date for filtering related events
  const today = new Date().toISOString().split("T")[0];

  // Fetch related events at the same venue
  let venueEvents: unknown[] = [];
  if (eventData.venue_id) {
    const { data } = await supabase
      .from("events")
      .select(`
        id, title, start_date, start_time,
        venue:venues(id, name, slug)
      `)
      .eq("venue_id", eventData.venue_id)
      .neq("id", eventId)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(4);

    venueEvents = data || [];
  }

  // Fetch events on the same date
  const { data: sameDateEvents } = await supabase
    .from("events")
    .select(`
      id, title, start_date, start_time,
      venue:venues(id, name, slug)
    `)
    .eq("start_date", eventData.start_date)
    .neq("id", eventId)
    .order("start_time", { ascending: true })
    .limit(4);

  // Fetch nearby spots if venue has location
  let nearbySpots: unknown[] = [];
  if (eventData.venue?.id && eventData.venue.neighborhood) {
    const { data } = await supabase
      .from("spots")
      .select("id, name, slug, spot_type, neighborhood")
      .eq("neighborhood", eventData.venue.neighborhood)
      .neq("venue_id", eventData.venue.id)
      .limit(6);

    nearbySpots = data || [];
  }

  // Check if event is currently live
  const now = new Date();
  const eventDate = new Date(eventData.start_date);
  const isToday = eventDate.toDateString() === now.toDateString();
  let isLive = false;

  if (isToday && eventData.start_time) {
    const [hours, minutes] = eventData.start_time.split(":").map(Number);
    const eventStart = new Date(eventDate);
    eventStart.setHours(hours, minutes, 0, 0);

    const eventEnd = new Date(eventStart);
    if (eventData.end_time) {
      const [endHours, endMinutes] = eventData.end_time.split(":").map(Number);
      eventEnd.setHours(endHours, endMinutes, 0, 0);
    } else {
      eventEnd.setHours(eventStart.getHours() + 3); // Default 3 hour duration
    }

    isLive = now >= eventStart && now <= eventEnd;
  }

  return Response.json({
    event: {
      ...(event as Record<string, unknown>),
      is_live: isLive,
    },
    venueEvents,
    sameDateEvents: sameDateEvents || [],
    nearbySpots,
  });
}
