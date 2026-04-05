import "server-only";

import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { isOpenAt, type HoursData } from "@/lib/hours";
import { parseFloatParam } from "@/lib/api-utils";
import { haversineDistanceKm } from "@/lib/geo";
import {
  resolvePortalQueryContext,
} from "@/lib/portal-query-context";
import {
  applyPortalScopeToQuery,
  expandCityFilterForMetro,
} from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";
import { VENUE_TYPE_ALIASES } from "@/lib/spots-constants";
import { buildExplorePlacesRequestParams } from "@/lib/explore-platform/places-request";
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import type { PlaceSeedSpot, PlacesLaneInitialData } from "@/lib/explore-platform/lane-data";

type VenueRow = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  place_type: string | null;
  location_designator:
    | "standard"
    | "private_after_signup"
    | "virtual"
    | "recovery_meeting"
    | null;
  city: string;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  price_level: number | null;
  hours: HoursData | null;
  short_description: string | null;
  address?: string | null;
};

type EventRow = {
  place_id: number;
  id?: number;
  title?: string;
  start_date?: string;
  start_time?: string | null;
};

function expandVenueTypes(types: string[]): string[] {
  const expanded = new Set(types);
  for (const type of types) {
    const aliases = VENUE_TYPE_ALIASES[type];
    if (aliases) {
      for (const alias of aliases) {
        expanded.add(alias);
      }
    }
  }
  return Array.from(expanded);
}

export async function getExplorePlacesInitialData({
  portalId,
  portalExclusive,
  params,
}: ExploreLaneServerLoaderArgs): Promise<PlacesLaneInitialData | null> {
  const requestParams = buildExplorePlacesRequestParams({
    portalId,
    isExclusive: portalExclusive,
    queryString: params.toString(),
    limit: 120,
  });
  const requestKey = requestParams.toString();

  const venueTypes = requestParams.get("venue_type")?.split(",").filter(Boolean);
  const neighborhoods = requestParams.get("neighborhood")?.split(",").filter(Boolean);
  const vibes = requestParams.get("vibes")?.split(",").filter(Boolean);
  const cuisine = requestParams.get("cuisine")?.split(",").filter(Boolean);
  const priceLevel = requestParams.get("price_level");
  const safeSearch = requestParams.get("q")?.toLowerCase().trim()?.replace(/[%_]/g, "\\$&");
  const includeEvents = requestParams.get("include_events") === "true";
  const centerLat = parseFloatParam(requestParams.get("center_lat"));
  const centerLng = parseFloatParam(requestParams.get("center_lng"));
  const hasCenter = centerLat !== null && centerLng !== null;

  const supabase = await createClient();
  const scopedParams = new URLSearchParams(requestParams.toString());
  scopedParams.set("portal_id", portalId);
  if (portalExclusive) {
    scopedParams.set("exclusive", "true");
  }
  const portalContext = await resolvePortalQueryContext(supabase, scopedParams);
  const portalClient = await createPortalScopedClient(portalId);
  const portalCityFilter = Array.from(
    new Set(
      [
        ...(portalContext.filters.cities || []),
        ...(portalContext.filters.city ? [portalContext.filters.city] : []),
      ]
        .map((city) => city.trim())
        .filter(Boolean),
    ),
  );
  const expandedPortalCities =
    portalCityFilter.length > 0
      ? expandCityFilterForMetro(portalCityFilter)
      : [];

  const venueSelect = [
    "id",
    "name",
    "slug",
    "neighborhood",
    "place_type",
    "location_designator",
    "city",
    "image_url",
    "price_level",
    "hours",
    "short_description",
    hasCenter ? "lat" : null,
    hasCenter ? "lng" : null,
    hasCenter ? "address" : null,
  ]
    .filter(Boolean)
    .join(", ");

  let query = supabase
    .from("places")
    .select(venueSelect)
    .neq("is_active", false);

  if (expandedPortalCities.length > 0) {
    query = query.in("city", expandedPortalCities);
  }

  if (venueTypes && venueTypes.length > 0) {
    query = query.in("place_type", expandVenueTypes(venueTypes));
  }
  if (neighborhoods && neighborhoods.length > 0) {
    query = query.in("neighborhood", neighborhoods);
  }
  if (priceLevel) {
    const levels = priceLevel
      .split(",")
      .map(Number)
      .filter((value) => !Number.isNaN(value));
    if (levels.length > 0) {
      query = query.in("price_level", levels);
    }
  }
  if (vibes && vibes.length > 0) {
    query = query.overlaps("vibes", vibes);
  }
  if (cuisine && cuisine.length > 0) {
    query = query.overlaps("cuisine", cuisine);
  }
  if (safeSearch) {
    query = query.or(
      `name.ilike.%${safeSearch}%,neighborhood.ilike.%${safeSearch}%,short_description.ilike.%${safeSearch}%`,
    );
  }

  const candidateLimit = 180;
  query = query.order("name").limit(candidateLimit);

  const { data: venueRows } = await query;
  const venues = (venueRows || []) as VenueRow[];
  const venueIds = venues.map((venue) => venue.id);

  const today = getLocalDateString();
  const eventsWindowEndDate = new Date();
  eventsWindowEndDate.setDate(eventsWindowEndDate.getDate() + 45);
  const eventsWindowEnd = getLocalDateString(eventsWindowEndDate);

  const eventCounts = new Map<number, number>();
  if (venueIds.length > 0) {
    const chunkSize = 300;
    const chunks: number[][] = [];
    for (let i = 0; i < venueIds.length; i += chunkSize) {
      chunks.push(venueIds.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map((venueIdChunk) => {
        let eventsQuery = portalClient
          .from("events")
          .select("place_id")
          .gte("start_date", today)
          .lte("start_date", eventsWindowEnd)
          .not("place_id", "is", null)
          .in("place_id", venueIdChunk);

        eventsQuery = applyPortalScopeToQuery(eventsQuery, {
          portalId,
          portalExclusive,
          publicOnlyWhenNoPortal: true,
        });

        return applyFeedGate(eventsQuery);
      }),
    );

    for (const result of results) {
      for (const event of (result.data || []) as EventRow[]) {
        eventCounts.set(
          event.place_id,
          (eventCounts.get(event.place_id) || 0) + 1,
        );
      }
    }
  }

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const now = new Date();
  let spots = venues.map((venue) => {
    const is24h =
      venue.hours != null &&
      DAY_KEYS.every((dayKey) => {
        const hours = venue.hours?.[dayKey];
        return (
          hours &&
          hours.open === "00:00" &&
          (hours.close === "00:00" || hours.close === "23:59")
        );
      });
    const openStatus = isOpenAt(venue.hours, now, is24h);
    const distanceKm =
      hasCenter && venue.lat !== null && venue.lng !== null
        ? haversineDistanceKm(centerLat!, centerLng!, venue.lat, venue.lng)
        : null;
    return {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      neighborhood: venue.neighborhood,
      place_type: venue.place_type,
      location_designator: venue.location_designator || "standard",
      image_url: venue.image_url,
      event_count: eventCounts.get(venue.id) || 0,
      price_level: venue.price_level,
      lat: hasCenter ? venue.lat : null,
      lng: hasCenter ? venue.lng : null,
      is_24_hours: is24h,
      short_description: venue.short_description,
      is_open: openStatus.isOpen,
      closes_at: openStatus.closesAt,
      distance_km: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null,
    } satisfies PlaceSeedSpot;
  });

  const addressNamePattern =
    /^\d+\s+[\w\s]+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Hwy|Highway|Pike|Circle|Trail)\b/i;
  spots = spots
    .filter((spot) => !addressNamePattern.test(spot.name))
    .sort((left, right) => {
      if ((left.event_count ?? 0) !== (right.event_count ?? 0)) {
        return (right.event_count ?? 0) - (left.event_count ?? 0);
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 120);

  if (includeEvents && spots.length > 0) {
    const spotIds = spots.map((spot) => spot.id);
    let eventsQuery = portalClient
      .from("events")
      .select("place_id, id, title, start_date, start_time")
      .in("place_id", spotIds)
      .gte("start_date", today)
      .lte("start_date", eventsWindowEnd)
      .is("canonical_event_id", null)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .limit(spotIds.length * 4);
    eventsQuery = applyPortalScopeToQuery(eventsQuery, {
      portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
    });
    eventsQuery = applyFeedGate(eventsQuery);
    const { data: eventDetails } = await eventsQuery;

    if (eventDetails) {
      const eventsPerVenue = new Map<number, EventRow[]>();
      for (const row of eventDetails as EventRow[]) {
        const existing = eventsPerVenue.get(row.place_id);
        if (!existing) {
          eventsPerVenue.set(row.place_id, [row]);
        } else if (existing.length < 2) {
          existing.push(row);
        }
      }

      spots = spots.map((spot) => {
        const venueEvents = eventsPerVenue.get(spot.id);
        if (!venueEvents) return spot;
        return {
          ...spot,
          upcoming_events: venueEvents.map((event) => ({
            id: event.id!,
            title: event.title!,
            start_date: event.start_date!,
            start_time: event.start_time || null,
          })),
        };
      });
    }
  }

  const allNeighborhoods = Array.from(
    new Set(venues.map((venue) => venue.neighborhood).filter(Boolean) as string[]),
  ).sort();

  return {
    spots,
    meta: {
      openCount: spots.filter((spot) => spot.is_open).length,
      neighborhoods: allNeighborhoods,
    },
    requestKey,
  };
}
