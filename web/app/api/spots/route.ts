import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { isOpenAt, type HoursData } from "@/lib/hours";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { parseFloatParam } from "@/lib/api-utils";
import { haversineDistanceKm, getWalkingMinutes, getProximityTier, getProximityLabel } from "@/lib/geo";
import { logger } from "@/lib/logger";
import {
  getCachedPortalQueryContext,
  resolvePortalQueryContext,
} from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, expandCityFilterForMetro } from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { buildStableSpotsSearchParamsKey } from "@/lib/spots-cache-key";
import { VENUE_TYPE_ALIASES } from "@/lib/spots-constants";
import { createServerTimingRecorder } from "@/lib/server-timing";
import {
  getEventLedVenueCandidateLimit,
  shouldUseEventLedSpotsDiscovery,
} from "@/lib/spots-request-plan";

export const dynamic = "force-dynamic";

/** Expand post-consolidation venue types to also include legacy DB aliases */
function expandVenueTypes(types: string[]): string[] {
  const expanded = new Set(types);
  for (const t of types) {
    const aliases = VENUE_TYPE_ALIASES[t];
    if (aliases) for (const a of aliases) expanded.add(a);
  }
  return Array.from(expanded);
}

function getBoundingBoxForRadiusKm(
  latitude: number,
  longitude: number,
  radiusKm: number,
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const latDelta = radiusKm / 111.32;
  const lngDelta =
    radiusKm /
    (111.32 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
}

const SPOTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — venue data is stable
const SPOTS_CACHE_MAX_ENTRIES = 160;
const SPOTS_CACHE_NAMESPACE = "api:spots";
const SPOTS_RESPONSE_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=120";
const SPOTS_EVENT_COUNTS_CACHE_NAMESPACE = "api:spots:event-counts";
const SPOTS_EVENT_COUNTS_CACHE_TTL_MS = 2 * 60 * 1000;
const SPOTS_NEIGHBORHOODS_CACHE_NAMESPACE = "api:spots:neighborhoods";
const SPOTS_NEIGHBORHOODS_CACHE_TTL_MS = 30 * 60 * 1000;
const SPOTS_IN_FLIGHT_LOADS = new Map<
  string,
  Promise<{ payload: Record<string, unknown>; serverTiming: string }>
>();
const PORTAL_PARAM_MISMATCH_ERROR = "PORTAL_PARAM_MISMATCH";

function buildSpotsEventCountsCacheKey(params: {
  portalId: string | null;
  isExclusive: boolean;
  today: string;
  eventsWindowEnd: string;
  portalCities: string[];
}): string {
  return JSON.stringify({
    portalId: params.portalId,
    exclusive: params.isExclusive,
    today: params.today,
    eventsWindowEnd: params.eventsWindowEnd,
    cities: [...params.portalCities].sort(),
  });
}

function buildSpotsNeighborhoodsCacheKey(params: {
  portalId: string | null;
  portalCities: string[];
}): string {
  return JSON.stringify({
    portalId: params.portalId,
    cities: [...params.portalCities].sort(),
  });
}

export async function GET(request: NextRequest) {
  const timing = createServerTimingRecorder();
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;
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
  // Escape PostgREST filter special characters in search term
  const safeSearch = search?.replace(/[%_]/g, "\\$&");
  const centerLat = parseFloatParam(searchParams.get("center_lat"));
  const centerLng = parseFloatParam(searchParams.get("center_lng"));
  const radiusKm = parseFloatParam(searchParams.get("radius_km"));
  const sortBy = searchParams.get("sort"); // distance | special_relevance | hybrid
  const includeHours = searchParams.get("include_hours") === "true";
  const includeEvents = searchParams.get("include_events") === "true";
  const cuisineParam = searchParams.get("cuisine")?.split(",").filter(Boolean);
  const responseLimitRaw = Number.parseInt(searchParams.get("limit") || "600", 10);
  const responseLimit = Number.isFinite(responseLimitRaw)
    ? Math.max(1, Math.min(responseLimitRaw, 1200))
    : 600;

  const hasCenter = centerLat !== null && centerLng !== null;
  const useEventLedDiscovery = shouldUseEventLedSpotsDiscovery({
    hasCenter,
    hasSearch: Boolean(safeSearch),
    sortBy,
    hasPriceLevel: Boolean(priceLevel),
    venueTypesCount: venueTypes?.length || 0,
    neighborhoodsCount: neighborhoods?.length || 0,
    vibesCount: vibes?.length || 0,
    genresCount: genres?.length || 0,
    cuisinesCount: cuisineParam?.length || 0,
  });

  if (hasCenter) {
    if (centerLat! < -90 || centerLat! > 90 || centerLng! < -180 || centerLng! > 180) {
      return NextResponse.json({ error: "Invalid center coordinates" }, { status: 400 });
    }
  }

  const cacheKey = buildStableSpotsSearchParamsKey(searchParams);
  const cachedPayload = await timing.measure("cache_lookup", () =>
    getSharedCacheJson<Record<string, unknown>>(SPOTS_CACHE_NAMESPACE, cacheKey)
  );
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: {
        "Cache-Control": SPOTS_RESPONSE_CACHE_CONTROL,
        "Server-Timing": `${timing.toHeader()}, cache_hit;dur=0.0;desc="shared"`,
      },
    });
  }

  const existingLoad = SPOTS_IN_FLIGHT_LOADS.get(cacheKey);
  if (existingLoad) {
    const result = await existingLoad;
    timing.addMetric("coalesced", 0, "inflight");
    return NextResponse.json(result.payload, {
      headers: {
        "Cache-Control": SPOTS_RESPONSE_CACHE_CONTROL,
        "Server-Timing": `${result.serverTiming}, ${timing.toHeader()}`,
      },
    });
  }

  const today = getLocalDateString();
  const eventsWindowEndDate = new Date();
  eventsWindowEndDate.setDate(eventsWindowEndDate.getDate() + 45);
  const eventsWindowEnd = getLocalDateString(eventsWindowEndDate);
  let spotsLoadPromise:
    | Promise<{ payload: Record<string, unknown>; serverTiming: string }>
    | null = null;

  try {
    async function loadSpotsPayload(): Promise<{
      payload: Record<string, unknown>;
      serverTiming: string;
    }> {
      const supabase = await createClient();
      const portalContext = await timing.measure("bootstrap", async () => {
        const cachedContext = await getCachedPortalQueryContext(searchParams);
        if (cachedContext) {
          timing.addMetric("portal_context_cache_hit", 0, "shared");
          return cachedContext;
        }
        return resolvePortalQueryContext(supabase, searchParams);
      });
      if (portalContext.hasPortalParamMismatch) {
        throw new Error(PORTAL_PARAM_MISMATCH_ERROR);
      }
      const portalId = isLegacyDefaultPortal ? null : portalContext.portalId;
      const portalClient = await createPortalScopedClient(portalId);
      const portalCityFilter = Array.from(
        new Set(
          [...(portalContext.filters.cities || []), ...(portalContext.filters.city ? [portalContext.filters.city] : [])]
            .map((c) => c.trim())
            .filter(Boolean),
        ),
      );
      const expandedPortalCities =
        portalCityFilter.length > 0
          ? expandCityFilterForMetro(portalCityFilter)
          : [];

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

    type SpotRow = {
      id: number;
      name: string;
      slug: string;
      neighborhood: string | null;
      venue_type: string | null;
      location_designator: string;
      image_url: string | null;
      event_count: number;
      price_level: number | null;
      lat: number | null;
      lng: number | null;
      hours_display: string | null;
      is_24_hours: boolean;
      vibes: string[] | null;
      short_description: string | null;
      genres: string[] | null;
      is_open: boolean;
      closes_at: string | null | undefined;
      distance_km: number | null;
      // Conditionally included fields
      address?: string | null;
      walking_minutes?: number | null;
      proximity_tier?: string | null;
      proximity_label?: string | null;
      hours?: HoursData | null;
    };

    // Fetch all active venues with enhanced data
    // Note: is_24_hours column may not exist in all environments
    let query = supabase
      .from("venues")
      .select("id, name, slug, address, neighborhood, venue_type, location_designator, city, image_url, lat, lng, price_level, hours, hours_display, vibes, short_description, genres")
      .neq("active", false); // Exclude deactivated venues

    // Venues table has no portal_id column, so we scope by city.
    if (portalCityFilter.length > 0) {
      const expandedCities = expandCityFilterForMetro(portalCityFilter);
      query = query.in("city", expandedCities);
    }

    if (hasCenter && radiusKm !== null && radiusKm > 0) {
      const bounds = getBoundingBoxForRadiusKm(centerLat!, centerLng!, radiusKm);
      query = query
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", bounds.minLat)
        .lte("lat", bounds.maxLat)
        .gte("lng", bounds.minLng)
        .lte("lng", bounds.maxLng);
    }

    // Apply venue type filter — expand through alias map to catch legacy DB types
    if (venueTypes && venueTypes.length > 0) {
      query = query.in("venue_type", expandVenueTypes(venueTypes));
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

    // Apply cuisine filter (array overlap)
    if (cuisineParam && cuisineParam.length > 0) {
      query = query.overlaps("cuisine", cuisineParam);
    }

    // Apply text search at DB level using ilike
    if (safeSearch) {
      query = query.or(
        `name.ilike.%${safeSearch}%,neighborhood.ilike.%${safeSearch}%,short_description.ilike.%${safeSearch}%`
      );
    }

    let venues: VenueRow[] | null = null;
    let eventCounts = new Map<number, number>();
    let allNeighborhoods: string[] = [];

    let usedEventLedDiscovery = false;
    if (useEventLedDiscovery) {
      try {
      const eventCountsCacheKey = buildSpotsEventCountsCacheKey({
        portalId,
        isExclusive,
        today,
        eventsWindowEnd,
        portalCities: expandedPortalCities,
      });
        const cachedEventCounts = await timing.measure("event_counts_cache_lookup", () =>
          getSharedCacheJson<Array<[number, number]>>(
            SPOTS_EVENT_COUNTS_CACHE_NAMESPACE,
            eventCountsCacheKey,
          ),
        );

        let sortedVenueCounts = cachedEventCounts;
        if (!sortedVenueCounts) {
          const { data: discoveryEvents, error: discoveryEventsError } =
            await timing.measure("event_counts_discovery", () =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (portalClient.rpc as any)("get_spot_event_counts", {
                p_start_date: today,
                p_end_date: eventsWindowEnd,
                p_portal_id: portalId,
                p_city_names: expandedPortalCities.length > 0 ? expandedPortalCities : null,
                p_limit: getEventLedVenueCandidateLimit(responseLimit, openNow),
              })
            );
          if (discoveryEventsError) {
            throw discoveryEventsError;
          }

          const discoveryCounts = new Map<number, number>();
          for (const row of
            ((discoveryEvents as Array<{ venue_id: number; event_count: number }> | null) ||
              [])) {
            discoveryCounts.set(row.venue_id, Number(row.event_count) || 0);
          }
          sortedVenueCounts = Array.from(discoveryCounts.entries()).sort(
            (left, right) => right[1] - left[1],
          );
          await setSharedCacheJson(
            SPOTS_EVENT_COUNTS_CACHE_NAMESPACE,
            eventCountsCacheKey,
            sortedVenueCounts,
            SPOTS_EVENT_COUNTS_CACHE_TTL_MS,
            { maxEntries: 120 },
          );
        }

        eventCounts = new Map(sortedVenueCounts);
        const candidateVenueIds = sortedVenueCounts
          .slice(0, getEventLedVenueCandidateLimit(responseLimit, openNow))
          .map(([venueId]) => venueId);

        if (candidateVenueIds.length > 0) {
          query = query.in("id", candidateVenueIds).limit(candidateVenueIds.length);
        } else {
          query = query.limit(responseLimit);
        }

        const { data: fastPathVenues, error: venuesError } = await timing.measure(
          "venues_query",
          () => query,
        );
        if (venuesError) {
          throw venuesError;
        }
        venues = (fastPathVenues as VenueRow[] | null) || [];

        const neighborhoodsCacheKey = buildSpotsNeighborhoodsCacheKey({
          portalId,
          portalCities: expandedPortalCities,
        });
        const cachedNeighborhoods = await timing.measure(
          "neighborhoods_cache_lookup",
          () =>
            getSharedCacheJson<string[]>(
              SPOTS_NEIGHBORHOODS_CACHE_NAMESPACE,
              neighborhoodsCacheKey,
            ),
        );
        if (cachedNeighborhoods) {
          allNeighborhoods = cachedNeighborhoods;
        } else {
          let neighborhoodsQuery = supabase
            .from("venues")
            .select("neighborhood")
            .neq("active", false);
          if (portalCityFilter.length > 0) {
            neighborhoodsQuery = neighborhoodsQuery.in(
              "city",
              expandedPortalCities,
            );
          }
          const { data: neighborhoodRows, error: neighborhoodsError } =
            await timing.measure("neighborhoods_query", () => neighborhoodsQuery);
          if (neighborhoodsError) {
            throw neighborhoodsError;
          }
          allNeighborhoods = Array.from(
            new Set(
              ((neighborhoodRows as Array<{ neighborhood: string | null }> | null) || [])
                .map((row) => row.neighborhood)
                .filter(Boolean) as string[],
            ),
          ).sort();
          await setSharedCacheJson(
            SPOTS_NEIGHBORHOODS_CACHE_NAMESPACE,
            neighborhoodsCacheKey,
            allNeighborhoods,
            SPOTS_NEIGHBORHOODS_CACHE_TTL_MS,
            { maxEntries: 120 },
          );
        }
        usedEventLedDiscovery = true;
      } catch (error) {
        timing.addMetric("event_led_fallback", 0, "error");
        logger.warn("Spots event-led discovery failed; falling back to venue-first path", {
          component: "api/spots",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!usedEventLedDiscovery) {
      const venueCandidateLimit = Math.max(
        700,
        Math.min(3000, responseLimit * 3),
      );
      query = query.order("name").limit(venueCandidateLimit);

      const buildEventCountsQuery = (venueIds: number[]) => {
        let scopedQuery = portalClient
          .from("events")
          .select("venue_id")
          .gte("start_date", today)
          .lte("start_date", eventsWindowEnd)
          .not("venue_id", "is", null)
          .in("venue_id", venueIds);

        scopedQuery = applyPortalScopeToQuery(scopedQuery, {
          portalId,
          portalExclusive: isExclusive,
          publicOnlyWhenNoPortal: true,
        });
        return applyFeedGate(scopedQuery);
      };

      const { data: fallbackVenues, error: venuesError } = await timing.measure(
        "venues_query",
        () => query,
      );
      if (venuesError) {
        throw venuesError;
      }

      venues = (fallbackVenues as VenueRow[] | null) || [];
      const venueIdsForCounts = venues.map((venue) => venue.id);
      const eventCountChunks: Promise<{ data: EventRow[] | null }>[] = [];
      const EVENT_COUNT_CHUNK_SIZE = 400;

      for (let i = 0; i < venueIdsForCounts.length; i += EVENT_COUNT_CHUNK_SIZE) {
        const venueIdChunk = venueIdsForCounts.slice(i, i + EVENT_COUNT_CHUNK_SIZE);
        eventCountChunks.push(buildEventCountsQuery(venueIdChunk));
      }

      const eventCountResults =
        eventCountChunks.length > 0
          ? await timing.measure("event_counts", () => Promise.all(eventCountChunks))
          : [];
      const events = eventCountResults.flatMap((result) => result.data || []);

      if (events) {
        for (const event of events as EventRow[]) {
          const count = eventCounts.get(event.venue_id) || 0;
          eventCounts.set(event.venue_id, count + 1);
        }
      }

      allNeighborhoods = [
        ...new Set(venues.map((v) => v.neighborhood).filter(Boolean)),
      ] as string[];
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

    // Combine venues with event counts and compute open status
    const now = new Date();
    const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    let spots = (venues as VenueRow[]).map(venue => {
      // Detect 24-hour venues: open 00:00 / close 00:00 (or 23:59) on all days
      const is24h = venue.hours != null && DAY_KEYS.every(d => {
        const h = venue.hours?.[d];
        return h && h.open === "00:00" && (h.close === "00:00" || h.close === "23:59");
      });
      const openStatus = isOpenAt(venue.hours, now, is24h);
      const distanceKm = hasCenter && venue.lat !== null && venue.lng !== null
        ? haversineDistanceKm(centerLat!, centerLng!, venue.lat, venue.lng)
        : null;
      const baseSpot: SpotRow = {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        neighborhood: venue.neighborhood,
        venue_type: venue.venue_type,
        location_designator: venue.location_designator || "standard",
        image_url: venue.image_url,
        event_count: eventCounts.get(venue.id) || 0,
        price_level: venue.price_level,
        lat: venue.lat,
        lng: venue.lng,
        hours_display: venue.hours_display,
        is_24_hours: is24h,
        vibes: venue.vibes,
        short_description: venue.short_description,
        genres: venue.genres,
        is_open: openStatus.isOpen,
        closes_at: openStatus.closesAt,
        distance_km: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null,
      };

      // Geo fields only when a center point is provided
      if (hasCenter) {
        baseSpot.address = venue.address;
        baseSpot.walking_minutes = distanceKm !== null ? getWalkingMinutes(distanceKm) : null;
        baseSpot.proximity_tier = distanceKm !== null ? getProximityTier(distanceKm) : null;
        baseSpot.proximity_label = distanceKm !== null ? getProximityLabel(distanceKm) : null;
      }

      if (includeHours) {
        baseSpot.hours = venue.hours;
      }

      return baseSpot;
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

    // Bound response size
    spots = spots.slice(0, responseLimit);

    const venueIds = spots.map((spot) => spot.id);

    // Optionally enrich with upcoming event details (next 2 per venue)
    if (includeEvents && venueIds.length > 0) {
      let eventDetailsQuery = portalClient
        .from("events")
        .select("venue_id, id, title, start_date, start_time")
        .in("venue_id", venueIds)
        .gte("start_date", today)
        .lte("start_date", eventsWindowEnd)
        .is("canonical_event_id", null)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false })
        .limit(venueIds.length * 4); // fetch a few per venue, trim client-side
      eventDetailsQuery = applyPortalScopeToQuery(eventDetailsQuery, {
        portalId,
        portalExclusive: isExclusive,
        publicOnlyWhenNoPortal: true,
      });
      eventDetailsQuery = applyFeedGate(eventDetailsQuery);
      const { data: eventDetails } = await timing.measure("event_details", () =>
        eventDetailsQuery
      );

      if (eventDetails) {
        type EventDetail = { venue_id: number; id: number; title: string; start_date: string; start_time: string | null };
        const eventsPerVenue = new Map<number, EventDetail[]>();
        for (const row of eventDetails as EventDetail[]) {
          const existing = eventsPerVenue.get(row.venue_id);
          if (!existing) {
            eventsPerVenue.set(row.venue_id, [row]);
          } else if (existing.length < 2) {
            existing.push(row);
          }
        }
        spots = spots.map((spot) => {
          const venueEvents = eventsPerVenue.get(spot.id);
          if (!venueEvents) return spot;
          return {
            ...spot,
            upcoming_events: venueEvents.map((e) => ({
              id: e.id,
              title: e.title,
              start_date: e.start_date,
              start_time: e.start_time,
            })),
          };
        });
      }
    }

    const openCount = spots.filter(s => s.is_open).length;

      const payload = {
        spots,
        meta: {
          total: spots.length,
          openCount,
          neighborhoods: allNeighborhoods.sort(),
        },
      };

      return {
        payload,
        serverTiming: timing.toHeader(),
      };
    }

    spotsLoadPromise = loadSpotsPayload();
    SPOTS_IN_FLIGHT_LOADS.set(cacheKey, spotsLoadPromise);
    const result = await spotsLoadPromise;
    await setSharedCacheJson(
      SPOTS_CACHE_NAMESPACE,
      cacheKey,
      result.payload,
      SPOTS_CACHE_TTL_MS,
      { maxEntries: SPOTS_CACHE_MAX_ENTRIES },
    );
    return NextResponse.json(result.payload, {
      headers: {
        "Cache-Control": SPOTS_RESPONSE_CACHE_CONTROL,
        "Server-Timing": result.serverTiming,
      },
    });
  } catch (error) {
    if ((error as Error).message === PORTAL_PARAM_MISMATCH_ERROR) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        {
          status: 400,
          headers: {
            "Server-Timing": timing.toHeader(),
          },
        },
      );
    }
    logger.error("Spots API error:", error);
    return NextResponse.json(
      { spots: [], error: "Failed to fetch spots" },
      {
        status: 500,
        headers: {
          "Server-Timing": timing.toHeader(),
        },
      },
    );
  } finally {
    const currentLoad = SPOTS_IN_FLIGHT_LOADS.get(cacheKey);
    if (currentLoad === spotsLoadPromise) {
      SPOTS_IN_FLIGHT_LOADS.delete(cacheKey);
    }
  }
}
