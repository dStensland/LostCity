import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { isOpenAt, type HoursData } from "@/lib/hours";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const portalId = searchParams.get("portal_id");
  const isExclusive = searchParams.get("exclusive") === "true";
  const withEventsOnly = searchParams.get("with_events") === "true";

  // New filters
  const openNow = searchParams.get("open_now") === "true";
  const priceLevel = searchParams.get("price_level"); // "1", "2", "3", "4" or comma-separated
  const venueTypes = searchParams.get("venue_type")?.split(",").filter(Boolean);
  const neighborhoods = searchParams.get("neighborhood")?.split(",").filter(Boolean);
  const vibes = searchParams.get("vibes")?.split(",").filter(Boolean);
  const search = searchParams.get("q")?.toLowerCase().trim();

  const today = getLocalDateString();

  try {
    type VenueRow = {
      id: number;
      name: string;
      slug: string;
      address: string | null;
      neighborhood: string | null;
      venue_type: string | null;
      city: string;
      image_url: string | null;
      price_level: number | null;
      hours: HoursData | null;
      hours_display: string | null;
      vibes: string[] | null;
      short_description: string | null;
    };

    type EventRow = {
      venue_id: number;
    };

    // Fetch all active venues with enhanced data
    // Note: is_24_hours column may not exist in all environments
    // TODO: Add portal-based geographic filtering when portals define their cities
    let query = supabase
      .from("venues")
      .select("id, name, slug, address, neighborhood, venue_type, city, image_url, price_level, hours, hours_display, vibes, short_description")
      .neq("active", false); // Exclude deactivated venues

    // Apply venue type filter
    if (venueTypes && venueTypes.length > 0) {
      query = query.in("venue_type", venueTypes);
    }

    // Apply neighborhood filter
    if (neighborhoods && neighborhoods.length > 0) {
      query = query.in("neighborhood", neighborhoods);
    }

    // Apply price level filter
    if (priceLevel) {
      const levels = priceLevel.split(",").map(Number).filter(n => !isNaN(n));
      if (levels.length > 0) {
        query = query.in("price_level", levels);
      }
    }

    // Apply vibes filter (array contains)
    if (vibes && vibes.length > 0) {
      query = query.overlaps("vibes", vibes);
    }

    query = query.order("name");

    const { data: venues, error: venuesError } = await query;

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

    // Combine venues with event counts and compute open status
    const now = new Date();
    let spots = (venues as VenueRow[]).map(venue => {
      const openStatus = isOpenAt(venue.hours, now, false);
      return {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        neighborhood: venue.neighborhood,
        venue_type: venue.venue_type,
        image_url: venue.image_url,
        event_count: eventCounts.get(venue.id) || 0,
        price_level: venue.price_level,
        hours: venue.hours,
        hours_display: venue.hours_display,
        is_24_hours: false,
        vibes: venue.vibes,
        short_description: venue.short_description,
        is_open: openStatus.isOpen,
        closes_at: openStatus.closesAt,
      };
    });

    // Filter to only venues with events if requested
    if (withEventsOnly) {
      spots = spots.filter(s => s.event_count > 0);
    }

    // Filter to only open venues if requested
    if (openNow) {
      spots = spots.filter(s => s.is_open);
    }

    // Apply text search filter (client-side for now)
    if (search) {
      spots = spots.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.neighborhood?.toLowerCase().includes(search) ||
        s.short_description?.toLowerCase().includes(search)
      );
    }

    // Sort: venues with events first (by count), then alphabetically
    spots.sort((a, b) => {
      if (a.event_count !== b.event_count) {
        return b.event_count - a.event_count;
      }
      return a.name.localeCompare(b.name);
    });

    // Compute metadata for filter UI (from full unfiltered data)
    const allNeighborhoods = [...new Set((venues as VenueRow[]).map(v => v.neighborhood).filter(Boolean))] as string[];
    const openCount = spots.filter(s => s.is_open).length;

    return NextResponse.json(
      {
        spots,
        meta: {
          total: spots.length,
          openCount,
          neighborhoods: allNeighborhoods.sort(),
        }
      },
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
