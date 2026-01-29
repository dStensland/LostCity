import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const portalId = searchParams.get("portal_id");
  const isExclusive = searchParams.get("exclusive") === "true";
  const withEventsOnly = searchParams.get("with_events") === "true";

  const today = new Date().toISOString().split("T")[0];

  try {
    type VenueRow = {
      id: number;
      name: string;
      slug: string;
      address: string | null;
      neighborhood: string | null;
      venue_type: string | null;
      city: string;
    };

    type EventRow = {
      venue_id: number;
    };

    // Fetch all active venues
    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("id, name, slug, address, neighborhood, venue_type, city")
      .eq("city", "Atlanta") // TODO: make this dynamic based on portal
      .neq("active", false) // Exclude deactivated venues
      .order("name");

    if (venuesError) {
      console.error("Venues query error:", venuesError);
      return NextResponse.json({ spots: [], error: venuesError.message }, { status: 500 });
    }

    if (!venues || venues.length === 0) {
      return NextResponse.json({ spots: [] });
    }

    // Get event counts for venues with upcoming events
    let eventsQuery = supabase
      .from("events")
      .select("venue_id")
      .gte("start_date", today)
      .not("venue_id", "is", null);

    // Apply portal filter for event counts
    if (isExclusive && portalId) {
      eventsQuery = eventsQuery.eq("portal_id", portalId);
    } else if (portalId === "default" || !portalId) {
      eventsQuery = eventsQuery.is("portal_id", null);
    } else {
      eventsQuery = eventsQuery.or(`portal_id.eq.${portalId},portal_id.is.null`);
    }

    const { data: events } = await eventsQuery;

    // Count events per venue
    const eventCounts = new Map<number, number>();
    if (events) {
      for (const event of events as EventRow[]) {
        const count = eventCounts.get(event.venue_id) || 0;
        eventCounts.set(event.venue_id, count + 1);
      }
    }

    // Combine venues with event counts
    let spots = (venues as VenueRow[]).map(venue => ({
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      address: venue.address,
      neighborhood: venue.neighborhood,
      venue_type: venue.venue_type,
      event_count: eventCounts.get(venue.id) || 0,
    }));

    // Filter to only venues with events if requested
    if (withEventsOnly) {
      spots = spots.filter(s => s.event_count > 0);
    }

    // Sort: venues with events first (by count), then alphabetically
    spots.sort((a, b) => {
      if (a.event_count !== b.event_count) {
        return b.event_count - a.event_count;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(
      { spots },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Spots API error:", error);
    return NextResponse.json({ spots: [], error: "Failed to fetch spots" }, { status: 500 });
  }
}
