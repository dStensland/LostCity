/**
 * GET /api/portals/[slug]/build-evening
 *
 * Auto-sequence engine for Plan My Evening.
 * Takes a date, vibe, party size, and start time, returns 3-5 sequenced stops.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorResponse, validationError } from "@/lib/api-utils";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { haversineDistanceKm, getWalkingMinutes } from "@/lib/geo";
import { applyFeedGate } from "@/lib/feed-gate";
import { scoreEventForConcierge } from "@/lib/concierge/event-relevance";
import { getDayPart } from "@/lib/forth-data";
import {
  VIBE_MAP,
  EVENING_SLOTS,
  LATE_NIGHT_VIBES,
  type EveningVibe,
  type EveningStop,
  type BuiltEveningResponse,
} from "@/lib/concierge/evening-vibes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMinutesToHHMM(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VenueRow = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  place_type: string | null;
  lat: number;
  lng: number;
  image_url: string | null;
  short_description: string | null;
  city: string | null;
};

type EventRow = {
  id: number;
  title: string;
  category_id: string | null;
  start_time: string;
  image_url: string | null;
  venue_id: number;
};

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);
  const { searchParams } = new URL(request.url);

  // Parse inputs
  const date = searchParams.get("date");
  const vibe = searchParams.get("vibe") as EveningVibe | null;
  const partySize = Math.min(Math.max(parseInt(searchParams.get("party_size") || "2") || 2, 1), 8);
  const startTime = searchParams.get("start_time") || "18:30";

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return validationError("date is required (YYYY-MM-DD)");
  }

  if (!vibe || !VIBE_MAP.has(vibe)) {
    return validationError("vibe is required (chill, adventurous, date_night, group, foodie)");
  }

  const vibeConfig = VIBE_MAP.get(vibe)!;
  const supabase = await createClient();

  // -----------------------------------------------------------------------
  // Resolve portal
  // -----------------------------------------------------------------------

  const { data: portalRaw } = await supabase
    .from("portals")
    .select("id, filters, settings")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  const portal = portalRaw as {
    id: string;
    filters: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
  } | null;

  if (!portal) {
    return errorResponse("Portal not found", "build-evening", 404);
  }

  const geoCenter = (portal.filters as Record<string, unknown> | null)?.geo_center as [number, number] | undefined;
  if (!geoCenter) {
    return errorResponse("Portal has no geo_center", "build-evening", 400);
  }

  const [centerLat, centerLng] = geoCenter;
  const radiusKm = 3; // Walking distance focus

  // -----------------------------------------------------------------------
  // Parallel fetch: venues + events
  // -----------------------------------------------------------------------

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01));

  const venueQuery = supabase
    .from("places")
    .select("id, name, slug, neighborhood, place_type, lat, lng, image_url, short_description, city")
    .neq("is_active", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .gte("lat", centerLat - latDelta)
    .lte("lat", centerLat + latDelta)
    .gte("lng", centerLng - lngDelta)
    .lte("lng", centerLng + lngDelta)
    .limit(500);

  let eventQuery = supabase
    .from("events")
    .select("id, title, category_id, start_time, image_url, place_id")
    .eq("start_date", date)
    .eq("is_active", true)
    .not("start_time", "is", null)
    .limit(200);
  eventQuery = applyFeedGate(eventQuery);

  const [{ data: venuesRaw }, { data: eventsRaw }] = await Promise.all([
    venueQuery,
    eventQuery,
  ]);

  const venues = (venuesRaw || []) as VenueRow[];
  const events = (eventsRaw || []) as EventRow[];

  // Compute distances and build lookup maps
  const venueDistances = new Map<number, number>();
  const venueMap = new Map<number, VenueRow>();

  for (const v of venues) {
    const dist = haversineDistanceKm(centerLat, centerLng, v.lat, v.lng);
    if (dist <= radiusKm) {
      venueDistances.set(v.id, dist);
      venueMap.set(v.id, v);
    }
  }

  // Filter events to nearby venues
  const nearbyEvents = events.filter((e) => venueDistances.has(e.venue_id));

  // -----------------------------------------------------------------------
  // Slot assignment algorithm
  // -----------------------------------------------------------------------

  const stops: EveningStop[] = [];
  const usedVenueIds = new Set<number>();
  let currentTime = startTime;
  let prevLat = centerLat;
  let prevLng = centerLng;

  const dayPart = getDayPart(new Date(`${date}T${startTime}`));

  // Get all venue types for this vibe
  const dinnerTypes = new Set(vibeConfig.venueTypes.dinner);
  const drinksTypes = new Set(vibeConfig.venueTypes.drinks);
  const lateNightTypes = new Set(vibeConfig.venueTypes.late_night);
  const eventCategories = new Set(vibeConfig.eventCategories);
  const includeLateNight = LATE_NIGHT_VIBES.has(vibe);

  // Determine which slots to fill
  const slotsToFill = EVENING_SLOTS.filter(
    (s) => s.id !== "late_night" || includeLateNight
  );

  for (const slot of slotsToFill) {
    let bestStop: EveningStop | null = null;

    if (slot.id === "event") {
      // Try to find a matching event
      const scoredEvents = nearbyEvents
        .filter((e) => {
          if (usedVenueIds.has(e.venue_id)) return false;
          if (!eventCategories.has(e.category_id || "")) return false;
          // Check event is in the right time window (within 2h of slot time)
          const [eH] = (e.start_time || "").split(":").map(Number);
          const [sH] = currentTime.split(":").map(Number);
          return Math.abs(eH - sH) <= 2;
        })
        .map((e) => ({
          event: e,
          score: scoreEventForConcierge(
            {
              id: String(e.id),
              title: e.title,
              start_date: date,
              start_time: e.start_time,
              image_url: e.image_url,
              category: e.category_id,
              distance_km: venueDistances.get(e.venue_id),
            },
            dayPart
          ),
        }))
        .sort((a, b) => b.score - a.score);

      if (scoredEvents.length > 0) {
        const best = scoredEvents[0].event;
        const venue = venueMap.get(best.venue_id)!;
        const walkDist = haversineDistanceKm(prevLat, prevLng, venue.lat, venue.lng);

        bestStop = {
          slot: slot.id,
          label: slot.label,
          time: best.start_time || currentTime,
          durationMinutes: slot.durationMinutes,
          type: "event",
          venue: {
            id: venue.id,
            name: venue.name,
            slug: venue.slug,
            lat: venue.lat,
            lng: venue.lng,
            place_type: venue.place_type,
            image_url: venue.image_url,
            neighborhood: venue.neighborhood,
          },
          event: {
            id: best.id,
            title: best.title,
            category: best.category_id,
            image_url: best.image_url,
          },
          reason: buildStopReason(slot.id, venue, best.title),
          walkFromPrevious: stops.length > 0
            ? { minutes: getWalkingMinutes(walkDist), distanceKm: Math.round(walkDist * 100) / 100 }
            : undefined,
        };

        usedVenueIds.add(venue.id);
        prevLat = venue.lat;
        prevLng = venue.lng;
      }
    }

    // If no event found for event slot, or for venue slots (dinner, drinks, late_night)
    if (!bestStop) {
      const targetTypes =
        slot.id === "dinner" ? dinnerTypes :
        slot.id === "drinks" ? drinksTypes :
        slot.id === "late_night" ? lateNightTypes :
        dinnerTypes; // fallback for event slot

      // Find best venue of matching type
      const candidates = Array.from(venueMap.values())
        .filter((v) => {
          if (usedVenueIds.has(v.id)) return false;
          return targetTypes.has(v.place_type || "");
        })
        .map((v) => ({
          venue: v,
          dist: haversineDistanceKm(prevLat, prevLng, v.lat, v.lng),
          hotelDist: venueDistances.get(v.id) || 99,
        }))
        .sort((a, b) => {
          // Prefer image > closer to previous stop > closer to hotel
          const aImg = a.venue.image_url ? 1 : 0;
          const bImg = b.venue.image_url ? 1 : 0;
          if (aImg !== bImg) return bImg - aImg;
          return a.dist - b.dist;
        });

      if (candidates.length > 0) {
        const best = candidates[0];
        const walkDist = best.dist;

        bestStop = {
          slot: slot.id,
          label: slot.label,
          time: currentTime,
          durationMinutes: slot.durationMinutes,
          type: "venue",
          venue: {
            id: best.venue.id,
            name: best.venue.name,
            slug: best.venue.slug,
            lat: best.venue.lat,
            lng: best.venue.lng,
            place_type: best.venue.place_type,
            image_url: best.venue.image_url,
            neighborhood: best.venue.neighborhood,
          },
          reason: buildStopReason(slot.id, best.venue),
          walkFromPrevious: stops.length > 0
            ? { minutes: getWalkingMinutes(walkDist), distanceKm: Math.round(walkDist * 100) / 100 }
            : undefined,
        };

        usedVenueIds.add(best.venue.id);
        prevLat = best.venue.lat;
        prevLng = best.venue.lng;
      }
    }

    if (bestStop) {
      stops.push(bestStop);
      // Advance time: current time + duration + walk time to next
      currentTime = addMinutesToHHMM(
        bestStop.time,
        bestStop.durationMinutes
      );
    }
  }

  const response: BuiltEveningResponse = {
    vibe,
    date,
    partySize,
    stops,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

// ---------------------------------------------------------------------------
// Reason builders
// ---------------------------------------------------------------------------

function buildStopReason(
  slot: string,
  venue: VenueRow,
  eventTitle?: string,
): string {
  const parts: string[] = [];

  if (eventTitle) {
    parts.push(eventTitle);
  }

  if (venue.short_description) {
    const match = venue.short_description.match(/^.+?(?<!\d)[.!?](?=\s|$)/);
    const desc = match ? match[0].trim() : venue.short_description.slice(0, 60).trim();
    parts.push(desc);
  } else {
    const labels: Record<string, string> = {
      dinner: "Great dinner spot",
      event: "Top pick for tonight",
      drinks: "Perfect for drinks",
      late_night: "Late-night favorite",
    };
    parts.push(labels[slot] || "Recommended");
  }

  if (venue.neighborhood) {
    parts.push(venue.neighborhood);
  }

  return parts.join(" \u00b7 ");
}
