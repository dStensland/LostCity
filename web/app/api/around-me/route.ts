import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { getNeighborhoodByName } from "@/config/neighborhoods";
import { isSpotOpen, VENUE_TYPES_MAP, type VenueType, DESTINATION_CATEGORIES } from "@/lib/spots";
import { getPortalBySlug } from "@/lib/portal";
import { isValidUUID } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

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

export type VenueTagData = {
  tag_id: string;
  tag_label: string;
  tag_group: string;
  score: number;
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
  tags?: VenueTagData[]; // Batch-loaded venue tags to prevent N+1 queries
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
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const neighborhood = searchParams.get("neighborhood");
  const radiusParam = searchParams.get("radius");
  // If no radius specified, don't filter by distance (show all)
  const radiusMiles = radiusParam ? parseFloat(radiusParam) : null;
  const category = searchParams.get("category"); // food, drinks, coffee, music, arts, fun
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const portalSlug = searchParams.get("portal");

  // Resolve portal ID for filtering
  let portalId: string | null = null;
  if (portalSlug) {
    const portal = await getPortalBySlug(portalSlug);
    // Validate the portal ID from the database is a UUID (defensive check)
    if (portal?.id && isValidUUID(portal.id)) {
      portalId = portal.id;
    }
  }

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

    // Filter by neighborhood if specified (exact match on neighborhood field)
    if (neighborhood && !usingGps) {
      spotsQuery = spotsQuery.eq("neighborhood", neighborhood);
    }

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

    // Filter by portal to prevent cross-portal leakage
    if (portalId) {
      eventsQuery = eventsQuery.or(`portal_id.eq.${portalId},portal_id.is.null`);
    } else {
      eventsQuery = eventsQuery.is("portal_id", null);
    }

    // Filter events by category if specified
    if (categoryFilter && categoryFilter.eventCategories.length > 0) {
      eventsQuery = eventsQuery.in("category", categoryFilter.eventCategories);
    }

    // Note: neighborhood filtering for events is done post-fetch since it's on the joined venue

    // Execute both queries in parallel
    const [spotsResult, eventsResult] = await Promise.all([
      spotsQuery,
      eventsQuery,
    ]);

    if (spotsResult.error) {
      logger.error("Error fetching spots:", spotsResult.error);
      throw spotsResult.error;
    }

    if (eventsResult.error) {
      logger.error("Error fetching events:", eventsResult.error);
      throw eventsResult.error;
    }

    const spots = (spotsResult.data || []) as SpotRow[];
    const events = (eventsResult.data || []) as LiveEventRow[];

    // Process spots - filter by open status and calculate distance
    const processedSpots: AroundMeItem[] = [];
    for (const spot of spots) {
      if (!spot.lat || !spot.lng) continue;

      const distance = calculateDistance(centerLat, centerLng, spot.lat, spot.lng);
      // Only filter by radius if one was specified
      if (radiusMiles !== null && distance > radiusMiles) continue;

      // Check if open - filter out spots confirmed closed
      let isOpen = true;
      let closesAt: string | undefined;

      if (spot.hours) {
        try {
          const result = isSpotOpen(spot.hours, false);
          isOpen = result.isOpen;
          closesAt = result.closesAt;
        } catch {
          // If hours parsing fails, treat as unknown (include in results)
          isOpen = true;
        }
      }

      // Skip spots that have hours data and are confirmed closed
      // Spots without hours data still pass through (unknown != closed)
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

      // Filter by neighborhood if specified (match venue's neighborhood)
      if (neighborhood && !usingGps) {
        if (event.venue?.neighborhood !== neighborhood) continue;
      }

      const distance = calculateDistance(centerLat, centerLng, lat, lng);
      // Only filter by radius if one was specified (GPS mode)
      if (radiusMiles !== null && distance > radiusMiles) continue;

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

    // Batch fetch venue tags to prevent N+1 queries (fixes critical perf issue)
    const spotIds = processedSpots.map((s) => s.id);
    if (spotIds.length > 0) {
      type TagRow = { venue_id: number; tag_id: string; tag_label: string; tag_group: string; score: number };
      const { data: tagData } = await supabase
        .from("venue_tag_summary")
        .select("venue_id, tag_id, tag_label, tag_group, score")
        .in("venue_id", spotIds)
        .gte("score", 2)
        .order("score", { ascending: false });

      // Group tags by venue_id (limit 3 per venue)
      const tagsByVenue = new Map<number, VenueTagData[]>();
      for (const tag of (tagData || []) as TagRow[]) {
        const existing = tagsByVenue.get(tag.venue_id) || [];
        if (existing.length < 3) {
          existing.push({
            tag_id: tag.tag_id,
            tag_label: tag.tag_label,
            tag_group: tag.tag_group,
            score: tag.score,
          });
          tagsByVenue.set(tag.venue_id, existing);
        }
      }

      // Attach tags to spots
      for (const spot of processedSpots) {
        const spotData = spot.data as AroundMeSpot;
        spotData.tags = tagsByVenue.get(spot.id) || [];
      }
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
    logger.error("Around me API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch nearby items", items: [], counts: { spots: 0, events: 0, total: 0 } },
      { status: 500 }
    );
  }
}
