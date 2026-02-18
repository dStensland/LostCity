import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseFloatParam, validationError } from "@/lib/api-utils";
import { haversineDistanceKm, getProximityTier, getWalkingMinutes, getProximityLabel } from "@/lib/geo";
import type { ProximityTier } from "@/lib/geo";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ISO 8601 weekday: 1=Monday, 7=Sunday
function getCurrentISOWeekday(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

type SpecialRow = {
  id: number;
  venue_id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
  image_url: string | null;
  confidence: string | null;
  source_url: string | null;
};

type VenueRow = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  short_description: string | null;
};

type SpecialResult = {
  id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  price_note: string | null;
  image_url: string | null;
  confidence: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    neighborhood: string | null;
    venue_type: string | null;
    image_url: string | null;
  };
  distance_km: number;
  walking_minutes: number;
  proximity_tier: ProximityTier;
  proximity_label: string;
};

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  // Required: center point for distance calculations
  const lat = parseFloatParam(searchParams.get("lat"));
  const lng = parseFloatParam(searchParams.get("lng"));

  if (lat === null || lng === null) {
    return validationError("lat and lng are required");
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return validationError("Invalid coordinates");
  }

  // Optional filters
  const radiusKm = parseFloatParam(searchParams.get("radius_km"), 5);
  const activeNow = searchParams.get("active_now") === "true";
  const typeFilter = searchParams.get("type")?.split(",").filter(Boolean);
  const tierFilter = searchParams.get("tier") as ProximityTier | null;

  try {
    const supabase = await createClient();

    // Fetch all active specials with their venues
    // venue_specials is not in generated types yet, so we use raw query
    const { data: specials, error: specialsError } = await supabase
      .from("venue_specials")
      .select("id, venue_id, title, type, description, days_of_week, time_start, time_end, start_date, end_date, price_note, image_url, confidence, source_url")
      .eq("is_active", true);

    if (specialsError) {
      logger.error("Specials API - fetch specials error:", specialsError);
      return NextResponse.json({ specials: [], error: "Failed to fetch specials" }, { status: 500 });
    }

    if (!specials || specials.length === 0) {
      return NextResponse.json({ specials: [], meta: { total: 0 } });
    }

    // Get unique venue IDs from specials
    const venueIds = [...new Set((specials as SpecialRow[]).map(s => s.venue_id))];

    // Fetch venue data for these venues
    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("id, name, slug, address, neighborhood, venue_type, lat, lng, image_url, short_description")
      .in("id", venueIds)
      .neq("active", false);

    if (venuesError) {
      logger.error("Specials API - fetch venues error:", venuesError);
      return NextResponse.json({ specials: [], error: "Failed to fetch venues" }, { status: 500 });
    }

    // Build venue lookup with distance info
    const venueMap = new Map<number, VenueRow & { distance_km: number }>();
    for (const venue of (venues || []) as VenueRow[]) {
      if (venue.lat === null || venue.lng === null) continue;

      const distKm = haversineDistanceKm(lat, lng, venue.lat, venue.lng);
      if (distKm <= (radiusKm ?? 5)) {
        venueMap.set(venue.id, { ...venue, distance_km: distKm });
      }
    }

    // Current time context for filtering
    const today = new Date().toISOString().split("T")[0];
    const currentDay = getCurrentISOWeekday();
    const currentTime = getCurrentTimeString();

    // Filter and enrich specials
    const results: SpecialResult[] = [];

    for (const special of specials as SpecialRow[]) {
      const venue = venueMap.get(special.venue_id);
      if (!venue) continue; // Venue not in radius or missing coordinates

      const tier = getProximityTier(venue.distance_km);

      // Apply tier filter if specified
      if (tierFilter && tier !== tierFilter) continue;

      // Apply type filter if specified
      if (typeFilter && typeFilter.length > 0 && !typeFilter.includes(special.type)) continue;

      // Date range check (for seasonal specials / exhibits)
      if (special.start_date && special.start_date > today) continue;
      if (special.end_date && special.end_date < today) continue;

      // Active now filtering
      if (activeNow) {
        // Check day of week
        if (special.days_of_week && special.days_of_week.length > 0) {
          if (!special.days_of_week.includes(currentDay)) continue;
        }

        // Check time window (if both start and end are specified)
        if (special.time_start && special.time_end) {
          // Handle overnight specials (e.g., 20:00 - 02:00)
          if (special.time_start > special.time_end) {
            // Overnight: active if current time >= start OR <= end
            if (currentTime < special.time_start && currentTime > special.time_end) continue;
          } else {
            // Normal: active if current time is between start and end
            if (currentTime < special.time_start || currentTime > special.time_end) continue;
          }
        } else if (special.time_start && !special.time_end) {
          // Has start but no end — active if past start time
          if (currentTime < special.time_start) continue;
        }
        // If no time specified, assume it's active all day (on matching days)
      }

      results.push({
        id: special.id,
        title: special.title,
        type: special.type,
        description: special.description,
        days_of_week: special.days_of_week,
        time_start: special.time_start,
        time_end: special.time_end,
        price_note: special.price_note,
        image_url: special.image_url || venue.image_url,
        confidence: special.confidence,
        venue: {
          id: venue.id,
          name: venue.name,
          slug: venue.slug,
          address: venue.address,
          neighborhood: venue.neighborhood,
          venue_type: venue.venue_type,
          image_url: venue.image_url,
        },
        distance_km: Math.round(venue.distance_km * 100) / 100,
        walking_minutes: getWalkingMinutes(venue.distance_km),
        proximity_tier: tier,
        proximity_label: getProximityLabel(venue.distance_km),
      });
    }

    // Sort by distance within each tier
    results.sort((a, b) => a.distance_km - b.distance_km);

    // Group counts by tier for metadata
    const tierCounts: Record<ProximityTier, number> = { walkable: 0, close: 0, destination: 0 };
    for (const r of results) {
      tierCounts[r.proximity_tier]++;
    }

    return NextResponse.json(
      {
        specials: results,
        meta: {
          total: results.length,
          tiers: tierCounts,
          center: { lat, lng },
          radius_km: radiusKm,
          active_now: activeNow,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    logger.error("Specials API error:", error);
    return NextResponse.json({ specials: [], error: "Failed to fetch specials" }, { status: 500 });
  }
}
