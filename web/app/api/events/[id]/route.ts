import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getDistanceMiles } from "@/lib/geo";
import { doTimeRangesOverlap, isSpotOpenDuringEvent, HoursData } from "@/lib/hours";

const NEARBY_RADIUS_MILES = 10;

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

  // Fetch event with venue (producer/series joins removed - FKs don't exist)
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, vibes, description, lat, lng)
    `)
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) {
    console.error("Event fetch error:", error);
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Cast to access properties
  const eventData = event as {
    venue_id?: number;
    venue?: {
      id: number;
      neighborhood?: string | null;
      lat?: number | null;
      lng?: number | null;
    };
    start_date: string;
    start_time?: string | null;
    end_time?: string | null;
    [key: string]: unknown;
  };

  // Get today's date for filtering related events
  const today = new Date().toISOString().split("T")[0];
  const eventDate = new Date(eventData.start_date);

  // Fetch related events at the same venue
  let venueEvents: unknown[] = [];
  if (eventData.venue_id) {
    const { data } = await supabase
      .from("events")
      .select(`
        id, title, start_date, start_time, end_time,
        venue:venues(id, name, slug)
      `)
      .eq("venue_id", eventData.venue_id)
      .neq("id", eventId)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(10);

    venueEvents = data || [];
  }

  // Fetch nearby events (same date, within 10 miles, ±2 hour overlap)
  let nearbyEvents: unknown[] = [];
  const venueLat = eventData.venue?.lat;
  const venueLng = eventData.venue?.lng;

  if (venueLat && venueLng) {
    // Fetch all events on the same date
    const { data: sameDateEvents } = await supabase
      .from("events")
      .select(`
        id, title, start_date, start_time, end_time,
        venue:venues(id, name, slug, lat, lng)
      `)
      .eq("start_date", eventData.start_date)
      .neq("id", eventId)
      .order("start_time", { ascending: true });

    if (sameDateEvents) {
      // Filter by distance and time overlap
      nearbyEvents = sameDateEvents.filter((e) => {
        const ev = e as {
          start_time?: string | null;
          end_time?: string | null;
          venue?: { lat?: number | null; lng?: number | null } | null;
        };

        // Check distance
        if (!ev.venue?.lat || !ev.venue?.lng) return false;
        const distance = getDistanceMiles(
          venueLat,
          venueLng,
          ev.venue.lat,
          ev.venue.lng
        );
        if (distance > NEARBY_RADIUS_MILES) return false;

        // Check time overlap (±2 hours)
        if (!eventData.start_time || !ev.start_time) return true; // Include if no time data
        return doTimeRangesOverlap(
          eventData.start_time,
          eventData.end_time || null,
          ev.start_time,
          ev.end_time || null,
          2 // 2 hour buffer
        );
      }).slice(0, 10);
    }
  } else {
    // Fallback: no venue coordinates, just get same-date events
    const { data: sameDateEvents } = await supabase
      .from("events")
      .select(`
        id, title, start_date, start_time, end_time,
        venue:venues(id, name, slug)
      `)
      .eq("start_date", eventData.start_date)
      .neq("id", eventId)
      .order("start_time", { ascending: true })
      .limit(10);

    nearbyEvents = sameDateEvents || [];
  }

  // Fetch nearby destinations from places table (Google Places data with hours)
  // Map places category_id to our destination categories
  const PLACES_CATEGORY_MAP: Record<string, string> = {
    restaurants: "food",
    bars: "drinks",
    nightclubs: "nightlife",
    coffee: "caffeine",
    entertainment: "fun",
  };

  type PlaceWithHours = {
    id: string;
    name: string;
    category_id: string;
    neighborhood_id: string | null;
    lat: number;
    lng: number;
    hours_json: { periods?: Array<{ open?: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }> } | null;
    is_24_hours: boolean;
    google_maps_url: string | null;
    closesAt?: string;
    distance?: number;
  };

  const nearbyDestinations: Record<string, PlaceWithHours[]> = {
    food: [],
    drinks: [],
    nightlife: [],
    caffeine: [],
    fun: [],
  };

  if (venueLat && venueLng) {
    // Fetch places from all relevant categories
    const { data: places } = await supabase
      .from("places")
      .select("id, name, category_id, neighborhood_id, lat, lng, hours_json, is_24_hours, google_maps_url")
      .in("category_id", Object.keys(PLACES_CATEGORY_MAP))
      .eq("hidden", false)
      .gte("final_score", 30);

    if (places) {
      // Filter by distance and categorize
      for (const place of places) {
        const p = place as PlaceWithHours;

        // Check distance
        const distance = getDistanceMiles(venueLat, venueLng, p.lat, p.lng);
        if (distance > NEARBY_RADIUS_MILES) continue;

        // Parse Google Places hours format to our HoursData format
        let hoursData: HoursData | null = null;
        if (p.hours_json?.periods) {
          const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
          hoursData = {};
          for (const period of p.hours_json.periods) {
            if (period.open) {
              const dayName = dayNames[period.open.day];
              const openTime = `${period.open.hour.toString().padStart(2, "0")}:${period.open.minute.toString().padStart(2, "0")}`;
              const closeTime = period.close
                ? `${period.close.hour.toString().padStart(2, "0")}:${period.close.minute.toString().padStart(2, "0")}`
                : "23:59";
              hoursData[dayName] = { open: openTime, close: closeTime };
            }
          }
        }

        // Check if place is open during event
        let closesAt: string | undefined;
        if (eventData.start_time && hoursData) {
          const openStatus = isSpotOpenDuringEvent(
            hoursData,
            eventDate,
            eventData.start_time,
            eventData.end_time || null,
            p.is_24_hours || false
          );

          // Skip places that aren't open during the event
          if (!openStatus.isRelevant) continue;
          closesAt = openStatus.closesAt;
        }

        // Map to destination category
        const destCategory = PLACES_CATEGORY_MAP[p.category_id];
        if (destCategory && nearbyDestinations[destCategory]) {
          nearbyDestinations[destCategory].push({
            ...p,
            closesAt,
            distance,
          });
        }
      }

      // Sort each category by distance
      for (const category of Object.keys(nearbyDestinations)) {
        nearbyDestinations[category].sort((a, b) => (a.distance || 0) - (b.distance || 0));
        // Limit to 10 per category
        nearbyDestinations[category] = nearbyDestinations[category].slice(0, 10);
      }
    }
  }

  // Check if event is currently live
  const now = new Date();
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
    nearbyEvents,
    nearbyDestinations,
  });
}
