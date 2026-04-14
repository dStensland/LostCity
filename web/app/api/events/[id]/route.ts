import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getDistanceMiles, getProximityLabel } from "@/lib/geo";
import { doTimeRangesOverlap, isSpotOpenDuringEvent, HoursData } from "@/lib/hours";
import { getLocalDateString } from "@/lib/formats";
import { logger } from "@/lib/logger";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { DESTINATION_CATEGORIES } from "@/lib/spots";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import { getDisplayParticipants, type EventArtist } from "@/lib/artists-utils";
import { buildDisplayDescription } from "@/lib/event-description";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import {
  calculatePreShowDiningTiming,
  type PreShowDiningTimingResult,
  type VenueDiningProfile,
} from "@/lib/planner/dining-timing";

const NEARBY_RADIUS_MILES = 2;
const EVENT_DETAIL_CACHE_TTL_MS = 60 * 1000;
const EVENT_DETAIL_CACHE_NAMESPACE = "api:event-detail";
const EVENT_DETAIL_CACHE_CONTROL = "public, max-age=30, s-maxage=60, stale-while-revalidate=120";
const DESTINATION_SELECT_BASE = "id, name, slug, place_type, neighborhood, lat, lng, hours, image_url, vibes";
const DESTINATION_SELECT_WITH_PLANNING = `${DESTINATION_SELECT_BASE}, service_style, meal_duration_min_minutes, meal_duration_max_minutes, walk_in_wait_minutes, payment_buffer_minutes, accepts_reservations, reservation_recommended`;

type RawEventArtist = {
  id: number;
  event_id: number;
  name: string;
  role: string | null;
  billing_order: number | null;
  is_headliner: boolean;
  artists: {
    id: string;
    name: string;
    slug: string;
    discipline: string;
    bio: string | null;
    image_url: string | null;
    genres: string[] | null;
    hometown: string | null;
    website: string | null;
    spotify_id: string | null;
    musicbrainz_id: string | null;
    wikidata_id: string | null;
    instagram: string | null;
    claimed_by: string | null;
    claimed_at: string | null;
    is_verified: boolean;
    created_at: string;
  } | null;
};

type EventDataShape = {
  place_id?: number;
  description?: string | null;
  venue?: {
    id: number;
    neighborhood?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  start_date: string;
  start_time?: string | null;
  end_time?: string | null;
  [key: string]: unknown;
};

type NearbyDestination = VenueDiningProfile & {
  id: number;
  name: string;
  slug: string;
  place_type: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  hours: HoursData | null;
  image_url: string | null;
  vibes: string[] | null;
  closesAt?: string;
  distance?: number;
  proximity_label?: string;
  pre_show_timing?: PreShowDiningTimingResult;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const estimateTravelToVenueMinutes = (distanceMiles: number | undefined): number => {
  if (typeof distanceMiles === "number" && Number.isFinite(distanceMiles)) {
    return Math.max(3, Math.round(distanceMiles * 20));
  }
  return 15;
};

async function fetchVenueEvents(
  supabase: SupabaseClient,
  eventData: EventDataShape,
  eventId: number,
  portalContext: Awaited<ReturnType<typeof resolvePortalQueryContext>>,
  portalExclusive: boolean,
  today: string
): Promise<unknown[]> {
  if (!eventData.place_id) return [];

  let venueEventsQuery = supabase
    .from("events")
    .select(`
      id, title, start_date, end_date, start_time, end_time,
      series_id, image_url, category, is_free, price_min,
      series:series!events_series_id_fkey(id, slug, title, series_type, image_url),
      venue:places(id, name, slug, city, neighborhood, location_designator, place_type)
    `)
    .eq("place_id", eventData.place_id)
    .neq("id", eventId)
    .is("canonical_event_id", null)
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    .or("is_class.is.null,is_class.eq.false");

  venueEventsQuery = applyPortalScopeToQuery(venueEventsQuery, {
    portalId: portalContext.portalId,
    portalExclusive,
    publicOnlyWhenNoPortal: true,
  });

  const { data } = await venueEventsQuery
    .order("start_date", { ascending: true })
    .limit(30);

  return data || [];
}

async function fetchNearbyEvents(
  supabase: SupabaseClient,
  eventData: EventDataShape,
  eventId: number,
  portalContext: Awaited<ReturnType<typeof resolvePortalQueryContext>>,
  portalExclusive: boolean,
  venueLat: number | null | undefined,
  venueLng: number | null | undefined
): Promise<unknown[]> {
  if (venueLat && venueLng) {
    // Fetch same-date events within a bounding box (~3-mile box covering the 2-mile radius)
    // Uses !inner join so PostgREST applies venue filters as AND conditions, not OR
    const LAT_DELTA = 0.04;
    const LNG_DELTA = 0.04;
    let sameDateQuery = supabase
      .from("events")
      .select(`
        id, title, start_date, start_time, end_time, category, is_free, price_min,
        venue:places!inner(id, name, slug, lat, lng, city, neighborhood, location_designator)
      `)
      .eq("start_date", eventData.start_date)
      .neq("id", eventId)
      .is("canonical_event_id", null)
      .or("is_class.is.null,is_class.eq.false")
      .gte("venue.lat", venueLat - LAT_DELTA)
      .lte("venue.lat", venueLat + LAT_DELTA)
      .gte("venue.lng", venueLng - LNG_DELTA)
      .lte("venue.lng", venueLng + LNG_DELTA);

    sameDateQuery = applyPortalScopeToQuery(sameDateQuery, {
      portalId: portalContext.portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
    });

    const { data: sameDateEvents } = await sameDateQuery
      .order("start_time", { ascending: true })
      .limit(100);

    if (!sameDateEvents) return [];

    // Filter by distance and time overlap
    return sameDateEvents.filter((e) => {
      const ev = e as {
        start_time?: string | null;
        end_time?: string | null;
        venue?: { lat?: number | null; lng?: number | null } | null;
      };

      // Check distance
      if (!ev.venue?.lat || !ev.venue?.lng) return false;
      const distance = getDistanceMiles(
        venueLat,
        venueLng,
        ev.venue.lat,
        ev.venue.lng
      );
      if (distance > NEARBY_RADIUS_MILES) return false;

      // Check time overlap (±2 hours)
      if (!eventData.start_time || !ev.start_time) return true; // Include if no time data
      return doTimeRangesOverlap(
        eventData.start_time,
        eventData.end_time || null,
        ev.start_time,
        ev.end_time || null,
        2 // 2 hour buffer
      );
    }).slice(0, 10);
  } else {
    // Fallback: no venue coordinates, just get same-date events (portal-scoped)
    let fallbackQuery = supabase
      .from("events")
      .select(`
        id, title, start_date, start_time, end_time, category, is_free, price_min,
        venue:places(id, name, slug, city, neighborhood, location_designator)
      `)
      .eq("start_date", eventData.start_date)
      .neq("id", eventId)
      .is("canonical_event_id", null)
      .or("is_class.is.null,is_class.eq.false");

    fallbackQuery = applyPortalScopeToQuery(fallbackQuery, {
      portalId: portalContext.portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
    });

    const { data: sameDateEvents } = await fallbackQuery
      .order("start_time", { ascending: true })
      .limit(10);

    return sameDateEvents || [];
  }
}

async function fetchNearbyDestinations(
  supabase: SupabaseClient,
  eventData: EventDataShape,
  venueLat: number | null | undefined,
  venueLng: number | null | undefined,
  eventDate: Date
): Promise<Record<string, NearbyDestination[]>> {
  const nearbyDestinations: Record<string, NearbyDestination[]> = {
    food: [],
    drinks: [],
    nightlife: [],
    caffeine: [],
    fun: [],
  };

  // Filter destinations by neighborhood
  if (eventData.venue?.neighborhood) {
    const allDestinationTypes = Object.values(DESTINATION_CATEGORIES).flat();

    // Fetch venues in the same neighborhood
    const spotsResult = await supabase
      .from("places")
      .select(DESTINATION_SELECT_WITH_PLANNING)
      .eq("neighborhood", eventData.venue.neighborhood)
      .in("place_type", allDestinationTypes)
      .eq("is_active", true)
      .neq("id", eventData.venue?.id || 0);
    let spots = spotsResult.data;

    if (
      spotsResult.error &&
      (spotsResult.error.message.includes("column") ||
        spotsResult.error.message.includes("schema cache"))
    ) {
      const fallbackResult = await supabase
        .from("places")
        .select(DESTINATION_SELECT_BASE)
        .eq("neighborhood", eventData.venue.neighborhood)
        .in("place_type", allDestinationTypes)
        .eq("is_active", true)
        .neq("id", eventData.venue?.id || 0);
      spots = fallbackResult.data;
    }

    if (spots) {
      for (const spot of spots) {
        const s = spot as NearbyDestination;

        // Calculate distance if we have coordinates (for sorting)
        let distance: number | undefined;
        if (s.lat && s.lng && venueLat && venueLng) {
          distance = getDistanceMiles(venueLat, venueLng, s.lat, s.lng);
        }

        // Check if spot is open during event (if we have hours data)
        let closesAt: string | undefined;
        if (eventData.start_time && s.hours) {
          const openStatus = isSpotOpenDuringEvent(
            s.hours,
            eventDate,
            eventData.start_time,
            eventData.end_time || null,
            false
          );

          // Skip spots that aren't open during the event (only if we have hours data)
          if (!openStatus.isRelevant) continue;
          closesAt = openStatus.closesAt;
        }

        // Determine category
        const venueType = s.place_type || "";
        let category: string | null = null;

        for (const [cat, types] of Object.entries(DESTINATION_CATEGORIES)) {
          if ((types as readonly string[]).includes(venueType)) {
            category = cat;
            break;
          }
        }

        if (category && nearbyDestinations[category]) {
          const preShowTiming =
            category === "food" && eventData.start_time
              ? calculatePreShowDiningTiming({
                  eventStartTime: eventData.start_time,
                  travelToVenueMinutes: estimateTravelToVenueMinutes(distance),
                  profile: {
                    venue_type: s.place_type,
                    service_style: s.service_style,
                    meal_duration_min_minutes: s.meal_duration_min_minutes,
                    meal_duration_max_minutes: s.meal_duration_max_minutes,
                    walk_in_wait_minutes: s.walk_in_wait_minutes,
                    payment_buffer_minutes: s.payment_buffer_minutes,
                    accepts_reservations: s.accepts_reservations,
                    reservation_recommended: s.reservation_recommended,
                  },
                })
              : undefined;

          const proximityLabel = distance !== undefined
            ? getProximityLabel(distance / 0.621371) // convert miles back to km for getProximityLabel
            : undefined;

          nearbyDestinations[category].push({
            ...s,
            closesAt,
            distance,
            proximity_label: proximityLabel,
            pre_show_timing: preShowTiming,
          });
        }
      }

      // Sort each category by distance (if available) and limit
      for (const category of Object.keys(nearbyDestinations)) {
        nearbyDestinations[category].sort((a, b) => (a.distance || 999) - (b.distance || 999));
        nearbyDestinations[category] = nearbyDestinations[category].slice(0, 10);
      }
    }
  } else if (venueLat && venueLng) {
    // Fallback: distance-based if no neighborhood (within 2 miles)
    const allDestinationTypes = Object.values(DESTINATION_CATEGORIES).flat();

    const spotsResult = await supabase
      .from("places")
      .select(DESTINATION_SELECT_WITH_PLANNING)
      .in("place_type", allDestinationTypes)
      .eq("is_active", true)
      .neq("id", eventData.venue?.id || 0)
      .limit(50);
    let spots = spotsResult.data;

    if (
      spotsResult.error &&
      (spotsResult.error.message.includes("column") ||
        spotsResult.error.message.includes("schema cache"))
    ) {
      const fallbackResult = await supabase
        .from("places")
        .select(DESTINATION_SELECT_BASE)
        .in("place_type", allDestinationTypes)
        .eq("is_active", true)
        .neq("id", eventData.venue?.id || 0)
        .limit(50);
      spots = fallbackResult.data;
    }

    if (spots) {
      for (const spot of spots) {
        const s = spot as NearbyDestination;

        // Filter by distance (2 miles max when no neighborhood)
        let distance: number | undefined;
        if (s.lat && s.lng) {
          distance = getDistanceMiles(venueLat, venueLng, s.lat, s.lng);
          if (distance > 2) continue;
        } else {
          continue; // Skip spots without coordinates in distance fallback
        }

        // Check if spot is open during event
        let closesAt: string | undefined;
        if (eventData.start_time && s.hours) {
          const openStatus = isSpotOpenDuringEvent(
            s.hours,
            eventDate,
            eventData.start_time,
            eventData.end_time || null,
            false
          );
          if (!openStatus.isRelevant) continue;
          closesAt = openStatus.closesAt;
        }

        // Determine category
        const venueType = s.place_type || "";
        let category: string | null = null;

        for (const [cat, types] of Object.entries(DESTINATION_CATEGORIES)) {
          if ((types as readonly string[]).includes(venueType)) {
            category = cat;
            break;
          }
        }

        if (category && nearbyDestinations[category]) {
          const preShowTiming =
            category === "food" && eventData.start_time
              ? calculatePreShowDiningTiming({
                  eventStartTime: eventData.start_time,
                  travelToVenueMinutes: estimateTravelToVenueMinutes(distance),
                  profile: {
                    venue_type: s.place_type,
                    service_style: s.service_style,
                    meal_duration_min_minutes: s.meal_duration_min_minutes,
                    meal_duration_max_minutes: s.meal_duration_max_minutes,
                    walk_in_wait_minutes: s.walk_in_wait_minutes,
                    payment_buffer_minutes: s.payment_buffer_minutes,
                    accepts_reservations: s.accepts_reservations,
                    reservation_recommended: s.reservation_recommended,
                  },
                })
              : undefined;

          const proximityLabel = distance !== undefined
            ? getProximityLabel(distance / 0.621371)
            : undefined;

          nearbyDestinations[category].push({
            ...s,
            closesAt,
            distance,
            proximity_label: proximityLabel,
            pre_show_timing: preShowTiming,
          });
        }
      }

      // Sort by distance and limit each category
      for (const category of Object.keys(nearbyDestinations)) {
        nearbyDestinations[category].sort((a, b) => (a.distance || 999) - (b.distance || 999));
        nearbyDestinations[category] = nearbyDestinations[category].slice(0, 10);
      }
    }
  }

  return nearbyDestinations;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;
  const eventId = parseInt(id, 10);

  if (isNaN(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const portalExclusive = searchParams.get("portal_exclusive") === "true";
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return Response.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 }
    );
  }
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;
  const cacheBucket = Math.floor(Date.now() / EVENT_DETAIL_CACHE_TTL_MS);
  const cacheKey = [
    eventId,
    portalContext.portalId || "no-portal",
    portalCity || "all-cities",
    portalExclusive ? "exclusive" : "shared",
    cacheBucket,
  ].join("|");
  const cachedPayload = await getSharedCacheJson<Record<string, unknown>>(
    EVENT_DETAIL_CACHE_NAMESPACE,
    cacheKey
  );
  if (cachedPayload) {
    return Response.json(cachedPayload, {
      headers: {
        "Cache-Control": EVENT_DETAIL_CACHE_CONTROL,
      },
    });
  }

  // Fetch event with venue, series, and producer
  let event: unknown | null = null;
  let error: { message?: string } | null = null;

  const fullSelect = `
    *,
    venue:places(id, name, slug, address, neighborhood, city, state, location_designator, vibes, description, lat, lng, place_type, nearest_marta_station, marta_walk_minutes, marta_lines, beltline_adjacent, beltline_segment, parking_type, parking_free, transit_score),
    series:series_id(
      id,
      title,
      slug,
      series_type,
      festival:festivals(id, name, slug, image_url, festival_type, location, neighborhood)
    ),
    producer:organizations(id, name, slug, org_type, website, logo_url)
  `;

  const fullResult = await supabase
    .from("events")
    .select(fullSelect)
    .eq("id", eventId)
    .maybeSingle();

  event = fullResult.data;
  error = fullResult.error as { message?: string } | null;

  // Fallback: schema may not include producer/series relationships yet
  if (error && !event) {
    const message = error.message || "";
    const isSchemaMismatch =
      message.includes("column") ||
      message.includes("relationship") ||
      message.includes("schema cache");

    if (isSchemaMismatch) {
      const fallbackResult = await supabase
        .from("events")
        .select(`
          *,
          venue:places(id, name, slug, address, neighborhood, city, state, location_designator, vibes, description, lat, lng, nearest_marta_station, marta_walk_minutes, marta_lines, beltline_adjacent, beltline_segment, parking_type, parking_free, transit_score)
        `)
        .eq("id", eventId)
        .maybeSingle();

      event = fallbackResult.data;
      error = fallbackResult.error as { message?: string } | null;
    }
  }

  if (error || !event) {
    logger.error("Event fetch error", error, { eventId, component: "events/[id]" });
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Cast to access properties
  const eventData = event as EventDataShape;

  // Get today's date for filtering related events
  const today = getLocalDateString();
  const eventDate = new Date(eventData.start_date);

  const venueLat = eventData.venue?.lat;
  const venueLng = eventData.venue?.lng;

  // Run all 4 independent fetches in parallel
  const [eventArtistRows, venueEventsRaw, nearbyEventsRaw, nearbyDestinations] = await Promise.all([
    // 1. Artists
    supabase
      .from("event_artists")
      .select(`
        id,
        event_id,
        name,
        role,
        billing_order,
        is_headliner,
        artists (
          id, name, slug, discipline, bio, image_url, genres, hometown, website,
          spotify_id, musicbrainz_id, wikidata_id, instagram, claimed_by, claimed_at, is_verified, created_at
        )
      `)
      .eq("event_id", eventId)
      .order("billing_order", { ascending: true, nullsFirst: false })
      .order("is_headliner", { ascending: false })
      .order("name", { ascending: true }),

    // 2. Venue events
    fetchVenueEvents(supabase, eventData, eventId, portalContext, portalExclusive, today),

    // 3. Nearby events
    fetchNearbyEvents(supabase, eventData, eventId, portalContext, portalExclusive, venueLat, venueLng),

    // 4. Nearby destinations
    fetchNearbyDestinations(supabase, eventData, venueLat, venueLng, eventDate),
  ]);

  const eventArtists: EventArtist[] = (eventArtistRows.data as RawEventArtist[] | null)?.map((row) => ({
    id: row.id,
    event_id: row.event_id,
    name: row.name,
    role: row.role,
    billing_order: row.billing_order,
    is_headliner: row.is_headliner,
    artist: row.artists,
  })) || [];
  const displayParticipants = getDisplayParticipants(eventArtists, {
    eventTitle: (eventData as { title?: string | null }).title || null,
    eventCategory: (eventData as { category?: string | null }).category || null,
  });

  // Apply portal city filter to venue events and nearby events
  let venueEvents: unknown[] = filterByPortalCity(
    venueEventsRaw as Array<{ venue?: { city?: string | null } | null }>,
    portalCity,
    { allowMissingCity: true }
  );
  let nearbyEvents: unknown[] = filterByPortalCity(
    nearbyEventsRaw as Array<{ venue?: { city?: string | null } | null }>,
    portalCity,
    { allowMissingCity: true }
  );

  // Enrich related events with social proof counts
  const relatedEventIds = [
    ...((venueEvents as { id: number }[]).map((e) => e.id) || []),
    ...((nearbyEvents as { id: number }[]).map((e) => e.id) || []),
  ];
  const relatedCounts = await fetchSocialProofCounts(Array.from(new Set(relatedEventIds)));

  venueEvents = (venueEvents as { id: number }[]).map((event) => {
    const counts = relatedCounts.get(event.id);
    return {
      ...event,
      going_count: counts?.going || 0,
      interested_count: counts?.interested || 0,
      recommendation_count: counts?.recommendations || 0,
    };
  });

  nearbyEvents = (nearbyEvents as { id: number; venue?: { lat?: number | null; lng?: number | null } | null }[]).map((event) => {
    const counts = relatedCounts.get(event.id);
    let distance: number | undefined;
    let proximity_label: string | undefined;
    if (venueLat && venueLng && event.venue?.lat && event.venue?.lng) {
      distance = getDistanceMiles(venueLat, venueLng, event.venue.lat, event.venue.lng);
      proximity_label = getProximityLabel(distance / 0.621371);
    }
    return {
      ...event,
      distance,
      proximity_label,
      going_count: counts?.going || 0,
      interested_count: counts?.interested || 0,
      recommendation_count: counts?.recommendations || 0,
    };
  });

  // Check if event is currently live
  const now = new Date();
  const isToday = eventDate.toDateString() === now.toDateString();
  let isLive = false;

  if (isToday && eventData.start_time) {
    const [hours, minutes] = eventData.start_time.split(":").map(Number);
    const eventStart = new Date(eventDate);
    eventStart.setHours(hours, minutes, 0, 0);

    const eventEnd = new Date(eventStart);
    if (eventData.end_time) {
      const [endHours, endMinutes] = eventData.end_time.split(":").map(Number);
      eventEnd.setHours(endHours, endMinutes, 0, 0);
    } else {
      eventEnd.setHours(eventStart.getHours() + 3); // Default 3 hour duration
    }

    isLive = now >= eventStart && now <= eventEnd;
  }

  const payload = {
    event: {
      ...(event as Record<string, unknown>),
      is_live: isLive,
      display_description: buildDisplayDescription(eventData.description || null, displayParticipants, {
        eventTitle: (eventData.title as string | null | undefined) || null,
        eventGenres: (eventData.genres as string[] | null | undefined) || null,
        eventTags: (eventData.tags as string[] | null | undefined) || null,
        eventCategory: (eventData.category as string | null | undefined) || null,
      }),
    },
    eventArtists: displayParticipants,
    venueEvents,
    nearbyEvents,
    nearbyDestinations,
  };
  await setSharedCacheJson(
    EVENT_DETAIL_CACHE_NAMESPACE,
    cacheKey,
    payload,
    EVENT_DETAIL_CACHE_TTL_MS,
    { maxEntries: 600 }
  );

  return Response.json(payload, {
    headers: {
      "Cache-Control": EVENT_DETAIL_CACHE_CONTROL,
    },
  });
}
