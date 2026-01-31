import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getDistanceMiles } from "@/lib/geo";
import { getLocalDateString } from "@/lib/formats";

// Destination category mappings for venues
const DESTINATION_CATEGORIES: Record<string, string[]> = {
  food: ["restaurant", "food_hall", "cooking_school"],
  drinks: ["bar", "brewery", "distillery", "winery", "rooftop", "sports_bar"],
  nightlife: ["club"],
  caffeine: ["coffee_shop"],
  fun: ["games", "eatertainment", "arcade", "karaoke"],
};

type NearbyDestination = {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  distance?: number;
  // Enhanced data for better display
  image_url: string | null;
  short_description: string | null;
  hours: Record<string, { open: string; close: string } | null> | null;
  hours_display: string | null;
  is_24_hours: boolean | null;
  vibes: string[] | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch spot/venue data
  const { data: spotData, error } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !spotData) {
    return Response.json({ error: "Spot not found" }, { status: 404 });
  }

  // Cast to avoid TypeScript 'never' type issue
  const spot = spotData as {
    id: number;
    neighborhood?: string | null;
    lat?: number | null;
    lng?: number | null;
    [key: string]: unknown;
  };

  // Get today's date for filtering upcoming events
  const today = getLocalDateString();

  // Fetch upcoming events at this venue
  const { data: upcomingEvents } = await supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, end_time, is_free, price_min, category
    `)
    .eq("venue_id", spot.id)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(20);

  // Fetch nearby destinations
  const nearbyDestinations: Record<string, NearbyDestination[]> = {
    food: [],
    drinks: [],
    nightlife: [],
    caffeine: [],
    fun: [],
  };

  const allDestinationTypes = Object.values(DESTINATION_CATEGORIES).flat();

  // Filter by neighborhood if available
  if (spot.neighborhood) {
    const { data: spots } = await supabase
      .from("venues")
      .select("id, name, slug, venue_type, neighborhood, lat, lng, image_url, short_description, hours, hours_display, is_24_hours, vibes")
      .eq("neighborhood", spot.neighborhood)
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", spot.id);

    if (spots) {
      for (const s of spots) {
        const dest = s as NearbyDestination;

        // Calculate distance if we have coordinates (for sorting)
        let distance: number | undefined;
        if (dest.lat && dest.lng && spot.lat && spot.lng) {
          distance = getDistanceMiles(spot.lat, spot.lng, dest.lat, dest.lng);
        }

        // Determine category
        const venueType = dest.venue_type || "";
        let category: string | null = null;

        for (const [cat, types] of Object.entries(DESTINATION_CATEGORIES)) {
          if (types.includes(venueType)) {
            category = cat;
            break;
          }
        }

        if (category && nearbyDestinations[category]) {
          nearbyDestinations[category].push({ ...dest, distance });
        }
      }

      // Sort each category by distance and limit
      for (const category of Object.keys(nearbyDestinations)) {
        nearbyDestinations[category].sort((a, b) => (a.distance || 999) - (b.distance || 999));
        nearbyDestinations[category] = nearbyDestinations[category].slice(0, 10);
      }
    }
  } else if (spot.lat && spot.lng) {
    // Fallback: distance-based if no neighborhood (within 2 miles)
    const { data: spots } = await supabase
      .from("venues")
      .select("id, name, slug, venue_type, neighborhood, lat, lng, image_url, short_description, hours, hours_display, is_24_hours, vibes")
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", spot.id);

    if (spots) {
      for (const s of spots) {
        const dest = s as NearbyDestination;

        // Filter by distance (2 miles max when no neighborhood)
        let distance: number | undefined;
        if (dest.lat && dest.lng) {
          distance = getDistanceMiles(spot.lat, spot.lng, dest.lat, dest.lng);
          if (distance > 2) continue;
        } else {
          continue;
        }

        // Determine category
        const venueType = dest.venue_type || "";
        let category: string | null = null;

        for (const [cat, types] of Object.entries(DESTINATION_CATEGORIES)) {
          if (types.includes(venueType)) {
            category = cat;
            break;
          }
        }

        if (category && nearbyDestinations[category]) {
          nearbyDestinations[category].push({ ...dest, distance });
        }
      }

      // Sort by distance and limit
      for (const category of Object.keys(nearbyDestinations)) {
        nearbyDestinations[category].sort((a, b) => (a.distance || 999) - (b.distance || 999));
        nearbyDestinations[category] = nearbyDestinations[category].slice(0, 10);
      }
    }
  }

  return Response.json({
    spot: spotData,
    upcomingEvents: upcomingEvents || [],
    nearbyDestinations,
  });
}
