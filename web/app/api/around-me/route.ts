import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getNeighborhoodByName } from "@/config/neighborhoods";
import { isSpotOpen, VENUE_TYPES_MAP, type VenueType, DESTINATION_CATEGORIES } from "@/lib/spots";

export const dynamic = "force-dynamic";

// Haversine formula to calculate distance between two points in miles
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Inferred closing times by venue type when hours data is missing
const INFERRED_CLOSING_TIMES: Record<string, string> = {
  // Bars and nightlife - late night
  bar: "02:00",
  club: "03:00",
  sports_bar: "02:00",
  rooftop: "00:00",
  lgbtq: "02:00",
  karaoke: "02:00",
  // Breweries and distilleries - medium late
  brewery: "22:00",
  distillery: "22:00",
  winery: "21:00",
  // Restaurants - varies
  restaurant: "22:00",
  food_hall: "21:00",
  // Coffee - early close
  coffee_shop: "18:00",
  // Entertainment
  games: "23:00",
  arcade: "23:00",
  eatertainment: "23:00",
  // Music venues - late
  music_venue: "02:00",
  comedy_club: "00:00",
  theater: "23:00",
};

// Get inferred closing time based on venue type
function getInferredClosingTime(venueType: string | null): string | null {
  if (!venueType) return null;
  return INFERRED_CLOSING_TIMES[venueType] || null;
}

// Format closing time for display
function formatClosingTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return minutes === 0 ? `${displayHours}${period}` : `${displayHours}:${minutes.toString().padStart(2, "0")}${period}`;
}

// Category filter mapping for unified items
const CATEGORY_FILTERS: Record<string, { spotTypes: string[]; eventCategories: string[] }> = {
  food: {
    spotTypes: ["restaurant", "food_hall", "cooking_school"],
    eventCategories: ["Food & Drink"],
  },
  drinks: {
    spotTypes: ["bar", "brewery", "distillery", "winery", "rooftop", "sports_bar"],
    eventCategories: [],
  },
  coffee: {
    spotTypes: ["coffee_shop"],
    eventCategories: [],
  },
  music: {
    spotTypes: ["music_venue"],
    eventCategories: ["Music"],
  },
  arts: {
    spotTypes: ["gallery", "museum", "theater", "studio"],
    eventCategories: ["Art", "Theater", "Film"],
  },
  fun: {
    spotTypes: ["games", "arcade", "karaoke", "eatertainment", "attraction"],
    eventCategories: ["Comedy", "Sports", "Family"],
  },
};

type HoursData = Record<string, { open: string; close: string } | null>;

type SpotRow = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  venue_type: string | null;
  venue_types: string[] | null;
  description: string | null;
  short_description: string | null;
  price_level: number | null;
  website: string | null;
  hours_display: string | null;
  hours: HoursData | null;
  vibes: string[] | null;
  image_url: string | null;
};

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
    slug: string;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
    venue_type: string | null;
  } | null;
};

export type AroundMeItem = {
  type: "spot" | "event";
  id: number;
  distance: number; // miles
  data: AroundMeSpot | AroundMeEvent;
};

export type AroundMeSpot = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  lat: number;
  lng: number;
  venue_type: string | null;
  venue_types: string[] | null;
  icon: string;
  label: string;
  price_level: number | null;
  vibes: string[] | null;
  image_url: string | null;
  isOpen: boolean;
  closesAt: string | null; // Formatted time like "2am"
  closingTimeInferred: boolean;
};

export type AroundMeEvent = {
  id: number;
  title: string;
  slug: string;
  start_time: string;
  end_time: string | null;
  is_all_day: boolean;
  category: string | null;
  subcategory: string | null;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  ticket_url: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
  lat: number;
  lng: number;
};

export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const neighborhood = searchParams.get("neighborhood");
  const radiusMiles = parseFloat(searchParams.get("radius") || "5");
  const category = searchParams.get("category"); // food, drinks, coffee, music, arts, fun
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  // Determine center point
  let centerLat: number;
  let centerLng: number;
  let usingGps = false;

  if (latParam && lngParam) {
    centerLat = parseFloat(latParam);
    centerLng = parseFloat(lngParam);
    usingGps = true;
  } else if (neighborhood) {
    const hood = getNeighborhoodByName(neighborhood);
    if (hood) {
      centerLat = hood.lat;
      centerLng = hood.lng;
    } else {
      return NextResponse.json(
        { error: "Unknown neighborhood" },
        { status: 400 }
      );
    }
  } else {
    // Default to Atlanta center (Ponce City Market area)
    centerLat = 33.772;
    centerLng = -84.365;
  }

  try {
    const supabase = await createClient();

    // Get category filter if specified
    const categoryFilter = category ? CATEGORY_FILTERS[category] : null;

    // Fetch open spots
    let spotsQuery = supabase
      .from("venues")
      .select(`
        id,
        name,
        slug,
        address,
        neighborhood,
        lat,
        lng,
        venue_type,
        venue_types,
        description,
        short_description,
        price_level,
        website,
        hours_display,
        hours,
        vibes,
        image_url
      `)
      .eq("active", true)
      .not("lat", "is", null)
      .not("lng", "is", null);

    // Filter by spot types if category specified
    if (categoryFilter && categoryFilter.spotTypes.length > 0) {
      const typeFilters = categoryFilter.spotTypes
        .map((t) => `venue_type.eq.${t}`)
        .join(",");
      spotsQuery = spotsQuery.or(typeFilters);
    } else {
      // Default: only include "place" venue types (bars, restaurants, etc.)
      const placeTypes = Object.keys(DESTINATION_CATEGORIES).flatMap(
        (key) => DESTINATION_CATEGORIES[key as keyof typeof DESTINATION_CATEGORIES]
      );
      const typeFilters = placeTypes.map((t) => `venue_type.eq.${t}`).join(",");
      spotsQuery = spotsQuery.or(typeFilters);
    }

    // Fetch live events
    let eventsQuery = supabase
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
          slug,
          neighborhood,
          lat,
          lng,
          venue_type
        )
      `)
      .eq("is_live", true)
      .is("canonical_event_id", null)
      .gte("start_date", new Date().toISOString().split("T")[0]);

    // Filter events by category if specified
    if (categoryFilter && categoryFilter.eventCategories.length > 0) {
      eventsQuery = eventsQuery.in("category", categoryFilter.eventCategories);
    }

    // Execute both queries in parallel
    const [spotsResult, eventsResult] = await Promise.all([
      spotsQuery,
      eventsQuery,
    ]);

    if (spotsResult.error) {
      console.error("Error fetching spots:", spotsResult.error);
      throw spotsResult.error;
    }

    if (eventsResult.error) {
      console.error("Error fetching events:", eventsResult.error);
      throw eventsResult.error;
    }

    const spots = (spotsResult.data || []) as SpotRow[];
    const events = (eventsResult.data || []) as LiveEventRow[];

    // Process spots - filter by open status and calculate distance
    const processedSpots: AroundMeItem[] = [];
    for (const spot of spots) {
      if (!spot.lat || !spot.lng) continue;

      const distance = calculateDistance(centerLat, centerLng, spot.lat, spot.lng);
      if (distance > radiusMiles) continue;

      // Check if open - filter out spots confirmed closed
      let isOpen = true;
      let closesAt: string | undefined;

      try {
        const result = isSpotOpen(spot.hours, false);
        isOpen = result.isOpen;
        closesAt = result.closesAt;
      } catch {
        // If hours parsing fails, assume open
        isOpen = true;
      }

      // Skip spots that have hours data and are confirmed closed
      // Spots without hours data (isSpotOpen returns true by default) still pass through
      if (!isOpen) continue;

      // Determine closing time display
      let closingTimeDisplay: string | null = null;
      let closingTimeInferred = false;

      if (closesAt) {
        closingTimeDisplay = formatClosingTime(closesAt);
      } else {
        // No hours data - try to infer
        const inferredClose = getInferredClosingTime(spot.venue_type);
        if (inferredClose) {
          closingTimeDisplay = formatClosingTime(inferredClose);
          closingTimeInferred = true;
        }
      }

      // Get icon and label for venue type
      const venueTypeInfo = spot.venue_type
        ? VENUE_TYPES_MAP[spot.venue_type as VenueType]
        : null;

      processedSpots.push({
        type: "spot",
        id: spot.id,
        distance,
        data: {
          id: spot.id,
          name: spot.name,
          slug: spot.slug,
          address: spot.address,
          neighborhood: spot.neighborhood,
          lat: spot.lat,
          lng: spot.lng,
          venue_type: spot.venue_type,
          venue_types: spot.venue_types,
          icon: venueTypeInfo?.icon || "📍",
          label: venueTypeInfo?.label || "Spot",
          price_level: spot.price_level,
          vibes: spot.vibes,
          image_url: spot.image_url,
          isOpen: true,
          closesAt: closingTimeDisplay,
          closingTimeInferred,
        },
      });
    }

    // Process events - calculate distance
    const processedEvents: AroundMeItem[] = [];
    for (const event of events) {
      const lat = event.venue?.lat;
      const lng = event.venue?.lng;
      if (!lat || !lng) continue;

      const distance = calculateDistance(centerLat, centerLng, lat, lng);
      if (distance > radiusMiles) continue;

      processedEvents.push({
        type: "event",
        id: event.id,
        distance,
        data: {
          id: event.id,
          title: event.title,
          slug: String(event.id),
          start_time: event.start_time,
          end_time: event.end_time,
          is_all_day: event.is_all_day,
          category: event.category,
          subcategory: event.subcategory,
          is_free: event.is_free,
          price_min: event.price_min,
          price_max: event.price_max,
          ticket_url: event.ticket_url,
          venue: event.venue
            ? {
                id: event.venue.id,
                name: event.venue.name,
                slug: event.venue.slug,
                neighborhood: event.venue.neighborhood,
              }
            : null,
          lat,
          lng,
        },
      });
    }

    // Merge and sort by distance
    const allItems = [...processedSpots, ...processedEvents];
    allItems.sort((a, b) => a.distance - b.distance);

    // Apply limit
    const limitedItems = allItems.slice(0, limit);

    return NextResponse.json(
      {
        items: limitedItems,
        counts: {
          spots: processedSpots.length,
          events: processedEvents.length,
          total: allItems.length,
        },
        center: {
          lat: centerLat,
          lng: centerLng,
          usingGps,
          neighborhood: neighborhood || null,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Around me API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch nearby items", items: [], counts: { spots: 0, events: 0, total: 0 } },
      { status: 500 }
    );
  }
}
