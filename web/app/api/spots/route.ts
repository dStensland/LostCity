import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { isOpenAt, type HoursData } from "@/lib/hours";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { parseFloatParam } from "@/lib/api-utils";
import { haversineDistanceKm, getWalkingMinutes, getProximityTier, getProximityLabel } from "@/lib/geo";
import { logger } from "@/lib/logger";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery } from "@/lib/portal-scope";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

export const dynamic = "force-dynamic";

const SPOTS_CACHE_TTL_MS = 60 * 1000;
const SPOTS_CACHE_MAX_ENTRIES = 160;
const SPOTS_CACHE_NAMESPACE = "api:spots";

function buildStableSearchParamsKey(searchParams: URLSearchParams): string {
  return Array.from(searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const isLegacyDefaultPortal = searchParams.get("portal_id") === "default";
  const isExclusive = searchParams.get("exclusive") === "true";
  const withEventsOnly = searchParams.get("with_events") === "true";

  // New filters
  const openNow = searchParams.get("open_now") === "true";
  const priceLevel = searchParams.get("price_level"); // "1", "2", "3", "4" or comma-separated
  const venueTypes = searchParams.get("venue_type")?.split(",").filter(Boolean);
  const neighborhoods = searchParams.get("neighborhood")?.split(",").filter(Boolean);
  const vibes = searchParams.get("vibes")?.split(",").filter(Boolean);
  const genres = searchParams.get("genres")?.split(",").filter(Boolean);
  const search = searchParams.get("q")?.toLowerCase().trim();
  const centerLat = parseFloatParam(searchParams.get("center_lat"));
  const centerLng = parseFloatParam(searchParams.get("center_lng"));
  const radiusKm = parseFloatParam(searchParams.get("radius_km"));
  const sortBy = searchParams.get("sort"); // distance | special_relevance | hybrid
  const includeHours = searchParams.get("include_hours") === "true";
  const responseLimitRaw = Number.parseInt(searchParams.get("limit") || "300", 10);
  const responseLimit = Number.isFinite(responseLimitRaw)
    ? Math.max(1, Math.min(responseLimitRaw, 600))
    : 300;

  const hasCenter = centerLat !== null && centerLng !== null;

  if (hasCenter) {
    if (centerLat! < -90 || centerLat! > 90 || centerLng! < -180 || centerLng! > 180) {
      return NextResponse.json({ error: "Invalid center coordinates" }, { status: 400 });
    }
  }

  const cacheKey = buildStableSearchParamsKey(searchParams);

  const today = getLocalDateString();
  const eventsWindowEndDate = new Date();
  eventsWindowEndDate.setDate(eventsWindowEndDate.getDate() + 45);
  const eventsWindowEnd = getLocalDateString(eventsWindowEndDate);
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return NextResponse.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 },
    );
  }
  const portalId = isLegacyDefaultPortal ? null : portalContext.portalId;
  const portalCityFilter = Array.from(
    new Set(
      [...(portalContext.filters.cities || []), ...(portalContext.filters.city ? [portalContext.filters.city] : [])]
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  );

  try {
    const payload = await getOrSetSharedCacheJson<Record<string, unknown>>(
      SPOTS_CACHE_NAMESPACE,
      cacheKey,
      SPOTS_CACHE_TTL_MS,
      async () => {
    type VenueRow = {
      id: number;
      name: string;
      slug: string;
      address: string | null;
      neighborhood: string | null;
      venue_type: string | null;
      location_designator: "standard" | "private_after_signup" | "virtual" | "recovery_meeting" | null;
      city: string;
      image_url: string | null;
      lat: number | null;
      lng: number | null;
      price_level: number | null;
      hours: HoursData | null;
      hours_display: string | null;
      vibes: string[] | null;
      short_description: string | null;
      genres: string[] | null;
    };

    type EventRow = {
      venue_id: number;
    };

    // Fetch all active venues with enhanced data
    // Note: is_24_hours column may not exist in all environments
    let query = supabase
      .from("venues")
      .select("id, name, slug, address, neighborhood, venue_type, location_designator, city, image_url, lat, lng, price_level, hours, hours_display, vibes, short_description, genres")
      .neq("active", false); // Exclude deactivated venues

    // Note: venues table has no portal_id column, so we scope by city instead
    if (portalCityFilter.length > 0) {
      query = query.in("city", portalCityFilter);
    }

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

    // Apply genres filter (array overlap)
    if (genres && genres.length > 0) {
      query = query.overlaps("genres", genres);
    }

    const venueCandidateLimit = Math.max(
      350,
      Math.min(2200, responseLimit * 4),
    );
    query = query.order("name").limit(venueCandidateLimit);

    const { data: venues, error: venuesError } = await query;

    if (venuesError) {
      throw venuesError;
    }

    if (!venues || venues.length === 0) {
      return {
        spots: [],
        meta: {
          total: 0,
          openCount: 0,
          neighborhoods: [],
        },
      };
    }

    // Get event counts for venues with upcoming events
    let eventsQuery = supabase
      .from("events")
      .select("venue_id")
      .gte("start_date", today)
      .lte("start_date", eventsWindowEnd)
      .not("venue_id", "is", null);

    eventsQuery = applyPortalScopeToQuery(eventsQuery, {
      portalId,
      portalExclusive: isExclusive,
      publicOnlyWhenNoPortal: true,
    });

    const eventCandidateLimit = Math.max(
      400,
      Math.min(3500, responseLimit * 5),
    );
    const { data: events } = await eventsQuery.limit(eventCandidateLimit);

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
      const distanceKm = hasCenter && venue.lat !== null && venue.lng !== null
        ? haversineDistanceKm(centerLat!, centerLng!, venue.lat, venue.lng)
        : null;
      const baseSpot = {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        neighborhood: venue.neighborhood,
        venue_type: venue.venue_type,
        location_designator: venue.location_designator || "standard",
        image_url: venue.image_url,
        event_count: eventCounts.get(venue.id) || 0,
        price_level: venue.price_level,
        lat: venue.lat,
        lng: venue.lng,
        hours_display: venue.hours_display,
        is_24_hours: false,
        vibes: venue.vibes,
        short_description: venue.short_description,
        genres: venue.genres,
        is_open: openStatus.isOpen,
        closes_at: openStatus.closesAt,
        distance_km: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null,
        walking_minutes: distanceKm !== null ? getWalkingMinutes(distanceKm) : null,
        proximity_tier: distanceKm !== null ? getProximityTier(distanceKm) : null,
        proximity_label: distanceKm !== null ? getProximityLabel(distanceKm) : null,
      };
      return includeHours
        ? { ...baseSpot, hours: venue.hours }
        : baseSpot;
    });

    // Filter to only venues with events if requested
    if (withEventsOnly) {
      spots = spots.filter(s => s.event_count > 0);
    }

    // Filter to only open venues if requested
    if (openNow) {
      spots = spots.filter(s => s.is_open);
    }

    // Filter by distance radius if geo center provided
    if (hasCenter && radiusKm !== null) {
      spots = spots.filter((s) => s.distance_km !== null && s.distance_km <= radiusKm);
    }

    // Hide venues whose name is just a street address (e.g. "1483 Chattahoochee Ave NW")
    const addressNamePattern = /^\d+\s+[\w\s]+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Hwy|Highway|Pike|Circle|Trail)\b/i;
    spots = spots.filter(s => !addressNamePattern.test(s.name));

    // Apply text search filter (client-side for now)
    if (search) {
      spots = spots.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.neighborhood?.toLowerCase().includes(search) ||
        s.short_description?.toLowerCase().includes(search)
      );
    }

    // Sort: venues with events first (by count), then alphabetically
    if (hasCenter && sortBy === "distance") {
      spots.sort((a, b) => {
        if (a.distance_km === null && b.distance_km === null) return a.name.localeCompare(b.name);
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;
        return a.name.localeCompare(b.name);
      });
    } else if (hasCenter && (sortBy === "hybrid" || sortBy === "special_relevance")) {
      spots.sort((a, b) => {
        const tierWeight = (tier: string | null | undefined) => {
          if (tier === "walkable") return 30;
          if (tier === "close") return 20;
          if (tier === "destination") return 10;
          return 0;
        };
        const aScore = tierWeight(a.proximity_tier) + Math.min(a.event_count || 0, 20) + (a.is_open ? 5 : 0);
        const bScore = tierWeight(b.proximity_tier) + Math.min(b.event_count || 0, 20) + (b.is_open ? 5 : 0);
        if (bScore !== aScore) return bScore - aScore;
        if (a.distance_km === null && b.distance_km === null) return a.name.localeCompare(b.name);
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;
        return a.name.localeCompare(b.name);
      });
    } else {
      spots.sort((a, b) => {
        if (a.event_count !== b.event_count) {
          return b.event_count - a.event_count;
        }
        return a.name.localeCompare(b.name);
      });
    }

    // Bound response size before social proof fanout queries.
    spots = spots.slice(0, responseLimit);

    // Fetch social proof counts (followers + recommendations) for returned venues only.
    const venueIds = spots.map((spot) => spot.id);
    const followerCounts = new Map<number, number>();
    const recommendationCounts = new Map<number, number>();
    if (venueIds.length > 0) {
      const [{ data: followsData }, { data: recData }] = await Promise.all([
        supabase
          .from("follows")
          .select("followed_venue_id")
          .in("followed_venue_id", venueIds)
          .not("followed_venue_id", "is", null),
        supabase
          .from("recommendations")
          .select("venue_id")
          .in("venue_id", venueIds)
          .eq("visibility", "public"),
      ]);

      for (const row of (followsData || []) as { followed_venue_id: number | null }[]) {
        if (row.followed_venue_id) {
          followerCounts.set(
            row.followed_venue_id,
            (followerCounts.get(row.followed_venue_id) || 0) + 1,
          );
        }
      }

      for (const row of (recData || []) as { venue_id: number | null }[]) {
        if (row.venue_id) {
          recommendationCounts.set(
            row.venue_id,
            (recommendationCounts.get(row.venue_id) || 0) + 1,
          );
        }
      }
    }

    spots = spots.map((spot) => ({
      ...spot,
      follower_count: followerCounts.get(spot.id) || 0,
      recommendation_count: recommendationCounts.get(spot.id) || 0,
    }));

    // Compute metadata for filter UI (from full unfiltered data)
    const allNeighborhoods = [...new Set((venues as VenueRow[]).map(v => v.neighborhood).filter(Boolean))] as string[];
    const openCount = spots.filter(s => s.is_open).length;

        return {
          spots,
          meta: {
            total: spots.length,
            openCount,
            neighborhoods: allNeighborhoods.sort(),
          }
        };
      },
      { maxEntries: SPOTS_CACHE_MAX_ENTRIES }
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    logger.error("Spots API error:", error);
    return NextResponse.json({ spots: [], error: "Failed to fetch spots" }, { status: 500 });
  }
}
