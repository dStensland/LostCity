import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getDistanceMiles } from "@/lib/geo";
import { doTimeRangesOverlap, isSpotOpenDuringEvent, HoursData } from "@/lib/hours";
import { getLocalDateString } from "@/lib/formats";
import { logger } from "@/lib/logger";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { DESTINATION_CATEGORIES } from "@/lib/spots";
import { fetchSocialProofCounts } from "@/lib/search";
import { getDisplayParticipants, type EventArtist } from "@/lib/artists-utils";
import { buildDisplayDescription } from "@/lib/event-description";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

const NEARBY_RADIUS_MILES = 10;
const EVENT_DETAIL_CACHE_TTL_MS = 60 * 1000;
const EVENT_DETAIL_CACHE_NAMESPACE = "api:event-detail";
const EVENT_DETAIL_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=120";

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
    created_at: string;
  } | null;
};

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
    venue:venues(id, name, slug, address, neighborhood, city, state, location_designator, vibes, description, lat, lng, nearest_marta_station, marta_walk_minutes, marta_lines, beltline_adjacent, beltline_segment, parking_type, parking_free, transit_score),
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
          venue:venues(id, name, slug, address, neighborhood, city, state, location_designator, vibes, description, lat, lng, nearest_marta_station, marta_walk_minutes, marta_lines, beltline_adjacent, beltline_segment, parking_type, parking_free, transit_score)
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

  const { data: eventArtistRows } = await supabase
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
        spotify_id, musicbrainz_id, wikidata_id, created_at
      )
    `)
    .eq("event_id", eventId)
    .order("billing_order", { ascending: true, nullsFirst: false })
    .order("is_headliner", { ascending: false })
    .order("name", { ascending: true });

  const eventArtists: EventArtist[] = (eventArtistRows as RawEventArtist[] | null)?.map((row) => ({
    id: row.id,
    event_id: row.event_id,
    name: row.name,
    role: row.role,
    billing_order: row.billing_order,
    is_headliner: row.is_headliner,
    artist: row.artists,
  })) || [];
  const displayParticipants = getDisplayParticipants(eventArtists, {
    eventTitle: (event as { title?: string | null }).title || null,
    eventCategory: (event as { category?: string | null }).category || null,
  });

  // Cast to access properties
  const eventData = event as {
    venue_id?: number;
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

  // Get today's date for filtering related events
  const today = getLocalDateString();
  const eventDate = new Date(eventData.start_date);

  // Fetch related events at the same venue (portal-scoped)
  let venueEvents: unknown[] = [];
  if (eventData.venue_id) {
    let venueEventsQuery = supabase
      .from("events")
      .select(`
        id, title, start_date, end_date, start_time, end_time,
        venue:venues(id, name, slug, city, location_designator)
      `)
      .eq("venue_id", eventData.venue_id)
      .neq("id", eventId)
      .is("canonical_event_id", null)
      .or(`start_date.gte.${today},end_date.gte.${today}`);

    venueEventsQuery = applyPortalScopeToQuery(venueEventsQuery, {
      portalId: portalContext.portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
    });

    const { data } = await venueEventsQuery
      .order("start_date", { ascending: true })
      .limit(10);

    venueEvents = data || [];
  }

  // Fetch nearby events (same date, within 10 miles, ±2 hour overlap)
  let nearbyEvents: unknown[] = [];
  const venueLat = eventData.venue?.lat;
  const venueLng = eventData.venue?.lng;

  if (venueLat && venueLng) {
    // Fetch all events on the same date (portal-scoped)
    let sameDateQuery = supabase
      .from("events")
      .select(`
        id, title, start_date, start_time, end_time,
        venue:venues(id, name, slug, lat, lng, city, location_designator)
      `)
      .eq("start_date", eventData.start_date)
      .neq("id", eventId)
      .is("canonical_event_id", null);

    sameDateQuery = applyPortalScopeToQuery(sameDateQuery, {
      portalId: portalContext.portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
    });

    const { data: sameDateEvents } = await sameDateQuery
      .order("start_time", { ascending: true })
      .limit(20);

    if (sameDateEvents) {
      // Filter by distance and time overlap
    nearbyEvents = sameDateEvents.filter((e) => {
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
    }
  } else {
    // Fallback: no venue coordinates, just get same-date events (portal-scoped)
    let fallbackQuery = supabase
      .from("events")
      .select(`
        id, title, start_date, start_time, end_time,
        venue:venues(id, name, slug, city, location_designator)
      `)
      .eq("start_date", eventData.start_date)
      .neq("id", eventId)
      .is("canonical_event_id", null);

    fallbackQuery = applyPortalScopeToQuery(fallbackQuery, {
      portalId: portalContext.portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
    });

    const { data: sameDateEvents } = await fallbackQuery
      .order("start_time", { ascending: true })
      .limit(10);

    nearbyEvents = sameDateEvents || [];
  }

  venueEvents = filterByPortalCity(
    venueEvents as Array<{ venue?: { city?: string | null } | null }>,
    portalCity,
    { allowMissingCity: true }
  );
  nearbyEvents = filterByPortalCity(
    nearbyEvents as Array<{ venue?: { city?: string | null } | null }>,
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

  nearbyEvents = (nearbyEvents as { id: number }[]).map((event) => {
    const counts = relatedCounts.get(event.id);
    return {
      ...event,
      going_count: counts?.going || 0,
      interested_count: counts?.interested || 0,
      recommendation_count: counts?.recommendations || 0,
    };
  });

  type NearbyDestination = {
    id: number;
    name: string;
    slug: string;
    venue_type: string | null;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
    hours: HoursData | null;
    closesAt?: string;
    distance?: number;
  };

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
    const { data: spots } = await supabase
      .from("venues")
      .select("id, name, slug, venue_type, neighborhood, lat, lng, hours")
      .eq("neighborhood", eventData.venue.neighborhood)
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", eventData.venue?.id || 0);

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
        const venueType = s.venue_type || "";
        let category: string | null = null;

        for (const [cat, types] of Object.entries(DESTINATION_CATEGORIES)) {
          if ((types as readonly string[]).includes(venueType)) {
            category = cat;
            break;
          }
        }

        if (category && nearbyDestinations[category]) {
          nearbyDestinations[category].push({
            ...s,
            closesAt,
            distance,
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

    const { data: spots } = await supabase
      .from("venues")
      .select("id, name, slug, venue_type, neighborhood, lat, lng, hours")
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", eventData.venue?.id || 0)
      .limit(50);

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
        const venueType = s.venue_type || "";
        let category: string | null = null;

        for (const [cat, types] of Object.entries(DESTINATION_CATEGORIES)) {
          if ((types as readonly string[]).includes(venueType)) {
            category = cat;
            break;
          }
        }

        if (category && nearbyDestinations[category]) {
          nearbyDestinations[category].push({ ...s, closesAt, distance });
        }
      }

      // Sort by distance and limit each category
      for (const category of Object.keys(nearbyDestinations)) {
        nearbyDestinations[category].sort((a, b) => (a.distance || 999) - (b.distance || 999));
        nearbyDestinations[category] = nearbyDestinations[category].slice(0, 10);
      }
    }
  }

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
