import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseFloatParam, parseIntParam, validationError, isValidUUID } from "@/lib/api-utils";
import { getLocalDateString } from "@/lib/formats";
import { getProximityTier, getProximityLabel, getWalkingMinutes, haversineDistanceKm, type ProximityTier } from "@/lib/geo";
import { logger } from "@/lib/logger";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type PortalFilters = {
  city?: string;
  cities?: string[];
  geo_center?: [number, number];
  geo_radius_km?: number;
};

type PortalRow = {
  id: string;
  slug: string;
  name: string;
  portal_type: string;
  parent_portal_id: string | null;
  filters: PortalFilters | string | null;
  settings: Record<string, unknown> | null;
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
  city: string | null;
  image_url: string | null;
  short_description: string | null;
  vibes: string[] | null;
};

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
  last_verified_at: string | null;
};

type EventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  venue_id: number | null;
  source_id: number | null;
  category: string | null;
};

type FollowRow = { followed_venue_id: number | null };
type RecommendationRow = { venue_id: number | null };

type SpecialState = "active_now" | "starting_soon" | "none";

type SpecialStatus = {
  state: "active_now" | "starting_soon" | "inactive";
  startsInMinutes: number | null;
  remainingMinutes: number | null;
};

const CONFIDENCE_SCORE: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SPECIALS_CACHE_TTL_MS = 60 * 1000;
const SPECIALS_CACHE_MAX_ENTRIES = 120;
const SPECIALS_CACHE_NAMESPACE = "api:portal-specials";

async function getCachedSpecialsPayload(
  key: string
): Promise<Record<string, unknown> | null> {
  return getSharedCacheJson<Record<string, unknown>>(
    SPECIALS_CACHE_NAMESPACE,
    key
  );
}

async function setCachedSpecialsPayload(
  key: string,
  payload: Record<string, unknown>
): Promise<void> {
  await setSharedCacheJson(
    SPECIALS_CACHE_NAMESPACE,
    key,
    payload,
    SPECIALS_CACHE_TTL_MS,
    { maxEntries: SPECIALS_CACHE_MAX_ENTRIES }
  );
}

function getCurrentISOWeekday(now: Date): number {
  const jsDay = now.getDay(); // 0=Sun
  return jsDay === 0 ? 7 : jsDay;
}

function parsePortalFilters(raw: PortalFilters | string | null | undefined): PortalFilters {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PortalFilters;
    } catch {
      return {};
    }
  }
  return raw;
}

function buildStableSearchParamsKey(searchParams: URLSearchParams): string {
  return Array.from(searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function getPortalCities(filters: PortalFilters): string[] {
  const fromCities = Array.isArray(filters.cities) ? filters.cities : [];
  const fromCity = filters.city ? [filters.city] : [];
  return Array.from(new Set([...fromCities, ...fromCity].map((v) => v?.trim()).filter(Boolean) as string[]));
}

function getTimeMinutes(time: string | null): number | null {
  if (!time) return null;
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function isSpecialDateEligible(special: SpecialRow, today: string): boolean {
  if (special.start_date && special.start_date > today) return false;
  if (special.end_date && special.end_date < today) return false;
  return true;
}

function getSpecialStatus(
  special: SpecialRow,
  now: Date,
  includeUpcomingHours: number,
  today: string
): SpecialStatus {
  if (!isSpecialDateEligible(special, today)) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  const currentIsoDay = getCurrentISOWeekday(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (special.days_of_week?.length && !special.days_of_week.includes(currentIsoDay)) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  const startMinutes = getTimeMinutes(special.time_start);
  const endMinutes = getTimeMinutes(special.time_end);
  const upcomingWindow = Math.max(0, Math.floor(includeUpcomingHours * 60));

  if (startMinutes === null && endMinutes === null) {
    return { state: "active_now", startsInMinutes: null, remainingMinutes: null };
  }

  if (startMinutes !== null && endMinutes === null) {
    if (currentMinutes >= startMinutes) {
      return { state: "active_now", startsInMinutes: 0, remainingMinutes: null };
    }
    const startsIn = startMinutes - currentMinutes;
    if (startsIn <= upcomingWindow) {
      return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
    }
    return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
  }

  if (startMinutes === null && endMinutes !== null) {
    if (currentMinutes <= endMinutes) {
      return { state: "active_now", startsInMinutes: null, remainingMinutes: endMinutes - currentMinutes };
    }
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  if (startMinutes !== null && endMinutes !== null) {
    // Overnight specials, e.g. 20:00 -> 02:00
    if (startMinutes > endMinutes) {
      const isActive = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      if (isActive) {
        const remaining = currentMinutes <= endMinutes
          ? endMinutes - currentMinutes
          : (24 * 60 - currentMinutes) + endMinutes;
        return { state: "active_now", startsInMinutes: 0, remainingMinutes: remaining };
      }
      const startsIn = startMinutes - currentMinutes;
      if (startsIn >= 0 && startsIn <= upcomingWindow) {
        return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      }
      return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
    }

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return {
        state: "active_now",
        startsInMinutes: 0,
        remainingMinutes: endMinutes - currentMinutes,
      };
    }

    if (currentMinutes < startMinutes) {
      const startsIn = startMinutes - currentMinutes;
      if (startsIn <= upcomingWindow) {
        return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      }
      return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
    }
  }

  return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
}

function getStatePriority(state: "active_now" | "starting_soon" | "inactive"): number {
  if (state === "active_now") return 3;
  if (state === "starting_soon") return 2;
  return 1;
}

function scoreDestination(
  tier: ProximityTier,
  state: SpecialState,
  confidence: string | null,
  followers: number,
  recommendations: number,
  lastVerifiedAt: string | null
): number {
  const proximityWeight = tier === "walkable" ? 100 : tier === "close" ? 60 : 30;
  const stateWeight = state === "active_now" ? 50 : state === "starting_soon" ? 20 : 0;
  const confidenceWeight = CONFIDENCE_SCORE[(confidence || "medium").toLowerCase()] || 1;

  let freshnessWeight = 0;
  if (lastVerifiedAt) {
    const ageMs = Date.now() - new Date(lastVerifiedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) freshnessWeight = 10;
    else if (ageDays <= 30) freshnessWeight = 5;
  }

  const socialWeight = Math.min(20, Math.floor(followers / 5) + Math.floor(recommendations / 4));
  return proximityWeight + stateWeight + confidenceWeight * 3 + freshnessWeight + socialWeight;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);

  const activeNowOnly = searchParams.get("active_now") === "true";
  const includeUpcomingHours = parseFloatParam(searchParams.get("include_upcoming_hours"), 2) ?? 2;
  const radiusKmParam = parseFloatParam(searchParams.get("radius_km"));
  const limit = Math.min(parseIntParam(searchParams.get("limit"), 60) ?? 60, 200);
  const latParam = parseFloatParam(searchParams.get("lat"));
  const lngParam = parseFloatParam(searchParams.get("lng"));
  const typeFilter = searchParams.get("types")?.split(",").map((v) => v.trim()).filter(Boolean) ?? [];
  const tierFilter = searchParams.get("tiers")?.split(",").map((v) => v.trim()).filter(Boolean) as ProximityTier[] | undefined;
  const cacheKey = `${slug}|${buildStableSearchParamsKey(searchParams)}`;
  const cachedPayload = await getCachedSpecialsPayload(cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }

  const supabase = await createClient();

  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name, portal_type, parent_portal_id, filters, settings")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portal = portalData as PortalRow | null;

  if (portalError || !portal || !isValidUUID(portal.id)) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const parsedFilters = parsePortalFilters(portal.filters);
  const portalCenter = parsedFilters.geo_center;
  const centerLat = latParam ?? portalCenter?.[0];
  const centerLng = lngParam ?? portalCenter?.[1];

  if (centerLat === undefined || centerLng === undefined || centerLat === null || centerLng === null) {
    return validationError("Portal geo center is missing. Provide lat and lng query params.");
  }

  if (centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180) {
    return validationError("Invalid coordinates");
  }

  const radiusKm = radiusKmParam ?? parsedFilters.geo_radius_km ?? 5;
  const cityFilter = getPortalCities(parsedFilters);

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));

  try {
    let venuesQuery = supabase
      .from("venues")
      .select("id, name, slug, address, neighborhood, venue_type, lat, lng, city, image_url, short_description, vibes")
      .neq("active", false)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", centerLat - latDelta)
      .lte("lat", centerLat + latDelta)
      .gte("lng", centerLng - lngDelta)
      .lte("lng", centerLng + lngDelta);

    if (cityFilter.length > 0) {
      venuesQuery = venuesQuery.in("city", cityFilter);
    }

    const venueFetchCap = Math.min(1200, Math.max(300, limit * 15));
    const { data: venuesData, error: venuesError } = await venuesQuery.limit(
      venueFetchCap,
    );
    if (venuesError) {
      logger.error("Destination specials - venue fetch error:", venuesError);
      return NextResponse.json({ destinations: [], error: "Failed to fetch venues" }, { status: 500 });
    }

    const venuesInRadius = ((venuesData || []) as VenueRow[])
      .map((venue) => {
        if (venue.lat === null || venue.lng === null) return null;
        const distanceKm = haversineDistanceKm(centerLat, centerLng, venue.lat, venue.lng);
        if (distanceKm > radiusKm) return null;
        return {
          ...venue,
          distance_km: distanceKm,
          walking_minutes: getWalkingMinutes(distanceKm),
          proximity_tier: getProximityTier(distanceKm),
          proximity_label: getProximityLabel(distanceKm),
        };
      })
      .filter((venue): venue is VenueRow & {
        distance_km: number;
        walking_minutes: number;
        proximity_tier: ProximityTier;
        proximity_label: string;
      } => venue !== null);

    if (venuesInRadius.length === 0) {
      return NextResponse.json({
        destinations: [],
        meta: {
          total: 0,
          active_now: 0,
          starting_soon: 0,
          center: { lat: centerLat, lng: centerLng },
          radius_km: radiusKm,
        },
      });
    }

    const candidateVenues = venuesInRadius
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, Math.min(600, Math.max(200, limit * 10)));
    const venueIds = candidateVenues.map((venue) => venue.id);

    let specialsQuery = supabase
      .from("venue_specials")
      .select("id, venue_id, title, type, description, days_of_week, time_start, time_end, start_date, end_date, price_note, image_url, confidence, source_url, last_verified_at")
      .in("venue_id", venueIds)
      .eq("is_active", true);

    if (typeFilter.length > 0) {
      specialsQuery = specialsQuery.in("type", typeFilter);
    }

    const { data: specialsData, error: specialsError } = await specialsQuery;
    if (specialsError) {
      logger.error("Destination specials - specials fetch error:", specialsError);
      return NextResponse.json({ destinations: [], error: "Failed to fetch specials" }, { status: 500 });
    }

    const specialsByVenue = new Map<number, SpecialRow[]>();
    for (const special of (specialsData || []) as SpecialRow[]) {
      if (!specialsByVenue.has(special.venue_id)) {
        specialsByVenue.set(special.venue_id, []);
      }
      specialsByVenue.get(special.venue_id)!.push(special);
    }

    const now = new Date();
    const today = getLocalDateString(now);

    const isExclusivePortal = portal.portal_type === "business" && !portal.parent_portal_id;
    const federationAccess = await getPortalSourceAccess(portal.id);
    const hasSubscribedSources = federationAccess.sourceIds.length > 0;

    let eventsQuery = supabase
      .from("events")
      .select("id, title, start_date, start_time, venue_id, source_id, category")
      .in("venue_id", venueIds)
      .gte("start_date", today)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");

    eventsQuery = applyFederatedPortalScopeToQuery(eventsQuery, {
      portalId: portal.id,
      portalExclusive: isExclusivePortal,
      sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
      publicOnlyWhenNoPortal: true,
    });

    const eventsLimit = Math.min(900, Math.max(300, venueIds.length * 2));
    const { data: eventsData } = await eventsQuery
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(eventsLimit);

    const nextEventByVenue = new Map<number, EventRow>();
    for (const event of (eventsData || []) as EventRow[]) {
      if (!event.venue_id) continue;
      if (event.source_id && federationAccess.categoryConstraints.has(event.source_id)) {
        const allowed = federationAccess.categoryConstraints.get(event.source_id);
        if (allowed !== null && allowed !== undefined && event.category && !allowed.includes(event.category)) {
          continue;
        }
      }
      if (!nextEventByVenue.has(event.venue_id)) {
        nextEventByVenue.set(event.venue_id, event);
      }
    }

    const [{ data: followsData }, { data: recommendationData }] = await Promise.all([
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

    const followersByVenue = new Map<number, number>();
    for (const row of (followsData || []) as FollowRow[]) {
      if (!row.followed_venue_id) continue;
      followersByVenue.set(row.followed_venue_id, (followersByVenue.get(row.followed_venue_id) || 0) + 1);
    }

    const recommendationsByVenue = new Map<number, number>();
    for (const row of (recommendationData || []) as RecommendationRow[]) {
      if (!row.venue_id) continue;
      recommendationsByVenue.set(row.venue_id, (recommendationsByVenue.get(row.venue_id) || 0) + 1);
    }

    const destinations = candidateVenues
      .map((venue) => {
        if (tierFilter?.length && !tierFilter.includes(venue.proximity_tier)) {
          return null;
        }

        const specials = specialsByVenue.get(venue.id) || [];
        const withStatus = specials.map((special) => ({
          special,
          status: getSpecialStatus(special, now, includeUpcomingHours, today),
        }));

        const activeSpecials = withStatus.filter((item) => item.status.state === "active_now");
        const startingSoonSpecials = withStatus.filter((item) => item.status.state === "starting_soon");

        let state: SpecialState = "none";
        if (activeSpecials.length > 0) state = "active_now";
        else if (startingSoonSpecials.length > 0) state = "starting_soon";

        if (activeNowOnly && state !== "active_now") {
          return null;
        }

        const sortedSpecials = withStatus.sort((a, b) => {
          const stateDelta = getStatePriority(b.status.state) - getStatePriority(a.status.state);
          if (stateDelta !== 0) return stateDelta;

          const confidenceA = CONFIDENCE_SCORE[(a.special.confidence || "medium").toLowerCase()] || 1;
          const confidenceB = CONFIDENCE_SCORE[(b.special.confidence || "medium").toLowerCase()] || 1;
          if (confidenceB !== confidenceA) return confidenceB - confidenceA;

          const startsA = a.status.startsInMinutes ?? Number.MAX_SAFE_INTEGER;
          const startsB = b.status.startsInMinutes ?? Number.MAX_SAFE_INTEGER;
          return startsA - startsB;
        });

        const top = sortedSpecials[0];
        const followers = followersByVenue.get(venue.id) || 0;
        const recommendations = recommendationsByVenue.get(venue.id) || 0;
        const score = scoreDestination(
          venue.proximity_tier,
          state,
          top?.special.confidence || null,
          followers,
          recommendations,
          top?.special.last_verified_at || null
        );

        const nextEvent = nextEventByVenue.get(venue.id);

        return {
          venue: {
            id: venue.id,
            name: venue.name,
            slug: venue.slug,
            address: venue.address,
            neighborhood: venue.neighborhood,
            venue_type: venue.venue_type,
            image_url: venue.image_url,
            short_description: venue.short_description,
            vibes: venue.vibes,
            city: venue.city,
          },
          distance_km: Math.round(venue.distance_km * 100) / 100,
          walking_minutes: venue.walking_minutes,
          proximity_tier: venue.proximity_tier,
          proximity_label: venue.proximity_label,
          special_state: state,
          top_special: top
            ? {
                id: top.special.id,
                title: top.special.title,
                type: top.special.type,
                description: top.special.description,
                time_start: top.special.time_start,
                time_end: top.special.time_end,
                price_note: top.special.price_note,
                confidence: top.special.confidence,
                source_url: top.special.source_url,
                image_url: top.special.image_url,
                starts_in_minutes: top.status.startsInMinutes,
                remaining_minutes: top.status.remainingMinutes,
                last_verified_at: top.special.last_verified_at,
              }
            : null,
          specials_count: specials.length,
          social_proof: {
            followers,
            recommendations,
          },
          next_event: nextEvent
            ? {
                id: nextEvent.id,
                title: nextEvent.title,
                start_date: nextEvent.start_date,
                start_time: nextEvent.start_time,
              }
            : null,
          score,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.distance_km - b.distance_km;
      })
      .slice(0, limit);

    const totals = {
      total: destinations.length,
      active_now: destinations.filter((d) => d.special_state === "active_now").length,
      starting_soon: destinations.filter((d) => d.special_state === "starting_soon").length,
      none: destinations.filter((d) => d.special_state === "none").length,
      tiers: {
        walkable: destinations.filter((d) => d.proximity_tier === "walkable").length,
        close: destinations.filter((d) => d.proximity_tier === "close").length,
        destination: destinations.filter((d) => d.proximity_tier === "destination").length,
      },
    };

    const payload = {
      portal: {
        id: portal.id,
        slug: portal.slug,
        name: portal.name,
      },
      destinations,
      meta: {
        ...totals,
        center: { lat: centerLat, lng: centerLng },
        radius_km: radiusKm,
        include_upcoming_hours: includeUpcomingHours,
        active_now_only: activeNowOnly,
      },
    };
    await setCachedSpecialsPayload(cacheKey, payload);

    return NextResponse.json(
      payload,
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    logger.error("Destination specials API error:", error);
    return NextResponse.json({ destinations: [], error: "Failed to fetch destination specials" }, { status: 500 });
  }
}
