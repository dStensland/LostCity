/**
 * GET /api/portals/[slug]/outing-suggestions
 *
 * Smart suggestions for before/after activities near an anchor event.
 * Returns a mix of venues (food, drinks, activities, explore) and
 * nearby events (shows, comedy, live music, trivia).
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  errorResponse,
  parseFloatParam,
  validationError,
} from "@/lib/api-utils";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { haversineDistanceKm, getWalkingMinutes } from "@/lib/geo";
import { isOpenAtTime, type HoursData } from "@/lib/hours";
import { expandCityFilterForMetro } from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";

export const dynamic = "force-dynamic";

import type { OutingSuggestion, SuggestionCategory } from "@/lib/outing-suggestions-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string }> };
type Slot = "before" | "after" | "both";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeHHMM(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function formatTimeDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Add minutes to an HH:MM string, wrapping at midnight */
function addMinutesToHHMM(hhmm: string, deltaMinutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m + deltaMinutes) % 1440 + 1440) % 1440;
  return formatTimeHHMM(Math.floor(total / 60), total % 60);
}

/** Convert HH:MM to total minutes since midnight */
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Check if a time falls within a window, handling midnight crossover */
function isTimeInWindow(time: string, windowStart: string, windowEnd: string): boolean {
  const t = hhmmToMinutes(time);
  const start = hhmmToMinutes(windowStart);
  const end = hhmmToMinutes(windowEnd);

  if (start <= end) {
    // Normal window: e.g. 14:00–18:00
    return t >= start && t <= end;
  }
  // Midnight crossover: e.g. 22:00–02:00
  return t >= start || t <= end;
}

// ---------------------------------------------------------------------------
// Venue type categorization
// ---------------------------------------------------------------------------

/** Venue types allowed for direct venue suggestions */
const VENUE_SUGGESTION_TYPES = new Set([
  // Food
  "restaurant", "cafe", "bakery", "diner", "pizzeria", "food_hall", "coffee_shop",
  // Drinks
  "bar", "brewery", "winery", "cocktail_bar", "sports_bar", "nightclub",
  "rooftop", "pub", "taproom", "distillery", "wine_bar", "lounge",
  // Activities
  "arcade", "bowling", "karaoke", "eatertainment", "comedy_club",
  "escape_room", "pool_hall",
  // Explore
  "museum", "gallery", "park", "bookstore", "record_store", "library",
]);

/** Broader set: venue types that host events worth suggesting */
const EVENT_VENUE_TYPES = new Set([
  ...VENUE_SUGGESTION_TYPES,
  "music_venue", "theater", "amphitheater", "arena", "stadium",
  "cinema", "club", "event_space", "convention_center",
  "community_center", "studio",
]);

function categorizeVenue(venueType: string | null): SuggestionCategory {
  if (!venueType) return "activity";
  const type = venueType.toLowerCase();
  const foodTypes = new Set([
    "restaurant", "cafe", "bakery", "diner", "pizzeria", "food_hall",
  ]);
  const drinkTypes = new Set([
    "bar", "brewery", "winery", "cocktail_bar", "sports_bar", "nightclub",
    "rooftop", "pub", "taproom", "distillery", "wine_bar", "lounge",
    "coffee_shop",
  ]);
  const sightTypes = new Set([
    "museum", "gallery", "park", "bookstore", "record_store", "library",
  ]);
  if (foodTypes.has(type)) return "food";
  if (drinkTypes.has(type)) return "drinks";
  if (sightTypes.has(type)) return "sight";
  return "activity";
}

// ---------------------------------------------------------------------------
// Reason builders
// ---------------------------------------------------------------------------

function buildVenueReason(
  category: string,
  walkMin: number,
  venue: { short_description: string | null; vibes: string[] | null },
  specialTitle?: string | null,
  mealLabel?: string,
): string {
  const walkLabel = walkMin <= 2 ? "right next door" : `${walkMin} min walk`;

  let descriptor: string;
  if (venue.short_description) {
    const match = venue.short_description.match(/^.+?(?<!\d)[.!?](?=\s|$)/);
    descriptor = match ? match[0].trim() : venue.short_description.slice(0, 80).trim();
    if (descriptor.endsWith(".")) descriptor = descriptor.slice(0, -1);
  } else if (venue.vibes && venue.vibes.length > 0) {
    descriptor = venue.vibes
      .slice(0, 3)
      .map((v) => v.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(", ");
  } else {
    descriptor =
      category === "food" ? (mealLabel === "late-night" ? "Perfect late-night bite" : `Great ${mealLabel ?? "dinner"} spot`) :
      category === "drinks" ? "Perfect for drinks" :
      category === "sight" ? "Worth a visit" :
      "Fun activity";
  }

  const parts = [descriptor, walkLabel];
  if (specialTitle) parts.push(specialTitle);
  return parts.join(" \u00b7 ");
}

function buildEventReason(
  event: { category_id: string | null; is_free: boolean; tags: string[] | null },
  walkMin: number,
  venueName: string,
): string {
  const walkLabel = walkMin <= 2 ? "right next door" : `${walkMin} min walk`;
  const parts: string[] = [];

  if (event.is_free) parts.push("Free");

  // Use event category for context
  if (event.category_id) {
    const CATEGORY_LABELS: Record<string, string> = {
      music: "Music", comedy: "Comedy", theater: "Theater", dance: "Dance",
      film: "Film", art: "Art", food_drink: "Food & Drink", sports: "Sports",
      fitness: "Fitness", outdoors: "Outdoors", games: "Games",
      workshops: "Workshops", education: "Education", words: "Words",
      conventions: "Conventions", volunteer: "Volunteer", civic: "Civic",
      support: "Support", religious: "Religious",
      // Legacy aliases kept for graceful degradation on existing saved preferences
      nightlife: "Nightlife", community: "Community", family: "Family",
      wellness: "Wellness", other: "Event",
    };
    const label = CATEGORY_LABELS[event.category_id] ??
      event.category_id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(label);
  }

  parts.push(`at ${venueName}`);
  parts.push(walkLabel);

  return parts.join(" \u00b7 ");
}

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

  const anchorLat = parseFloatParam(searchParams.get("anchor_lat"));
  const anchorLng = parseFloatParam(searchParams.get("anchor_lng"));
  const anchorTime = searchParams.get("anchor_time"); // HH:MM (event start)
  const anchorEndTime = searchParams.get("anchor_end_time"); // HH:MM (event end, optional)
  const anchorDate = searchParams.get("anchor_date"); // YYYY-MM-DD
  const anchorEventId = searchParams.get("anchor_event_id"); // exclude this event from results
  const slot = searchParams.get("slot"); // "before" | "after" | "both"
  const categoriesFilter = searchParams.get("categories");
  const radiusKm = Math.min(parseFloatParam(searchParams.get("radius_km"), 2) ?? 2, 10);

  if (anchorLat === null || anchorLng === null || !anchorTime || !anchorDate || !slot) {
    return validationError("anchor_lat, anchor_lng, anchor_time, anchor_date, and slot are required");
  }

  if (slot !== "before" && slot !== "after" && slot !== "both") {
    return validationError("slot must be 'before', 'after', or 'both'");
  }

  // Parse anchor time
  const [anchorH, anchorM] = anchorTime.split(":").map(Number);
  if (isNaN(anchorH) || isNaN(anchorM)) {
    return validationError("anchor_time must be in HH:MM format");
  }

  // Parse anchor end time (default to start + 2h if not provided)
  let anchorEndH: number;
  let anchorEndM: number;
  if (anchorEndTime) {
    const [eh, em] = anchorEndTime.split(":").map(Number);
    anchorEndH = isNaN(eh) ? (anchorH + 2) % 24 : eh;
    anchorEndM = isNaN(em) ? anchorM : em;
  } else {
    const endTotal = (anchorH * 60 + anchorM + 120) % 1440;
    anchorEndH = Math.floor(endTotal / 60);
    anchorEndM = endTotal % 60;
  }

  const supabase = await createClient();

  // -----------------------------------------------------------------------
  // Fetch portal with filters for city scoping
  // -----------------------------------------------------------------------

  const { data: rawPortalData } = await supabase
    .from("portals")
    .select("id, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  const portalData = rawPortalData as { id: string; filters: Record<string, unknown> | string | null } | null;

  if (!portalData) {
    return errorResponse("Portal not found", "outing-suggestions", 404);
  }

  // Extract city filter from portal
  let portalCities: string[] = [];
  if (portalData.filters) {
    const filters = typeof portalData.filters === "string"
      ? (() => { try { return JSON.parse(portalData.filters as string); } catch { return {}; } })()
      : portalData.filters as Record<string, unknown>;
    const rawCities = [
      ...(Array.isArray(filters.cities) ? filters.cities : []),
      ...(typeof filters.city === "string" ? [filters.city] : []),
    ].filter(Boolean) as string[];
    if (rawCities.length > 0) {
      portalCities = expandCityFilterForMetro(rawCities);
    }
  }

  // -----------------------------------------------------------------------
  // Find ALL nearby venues (no type filter — we filter locally)
  // -----------------------------------------------------------------------

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((anchorLat * Math.PI) / 180), 0.01));

  let venueQuery = supabase
    .from("venues")
    .select(`
      id, name, slug, address, neighborhood, venue_type,
      lat, lng, image_url, short_description, vibes, hours, city
    `)
    .neq("active", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .gte("lat", anchorLat - latDelta)
    .lte("lat", anchorLat + latDelta)
    .gte("lng", anchorLng - lngDelta)
    .lte("lng", anchorLng + lngDelta)
    .limit(500);

  if (portalCities.length > 0) {
    venueQuery = venueQuery.in("city", portalCities);
  }

  const { data: venuesRaw } = await venueQuery;

  if (!venuesRaw || venuesRaw.length === 0) {
    return NextResponse.json({ before: [], after: [] });
  }

  type VenueRow = {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    neighborhood: string | null;
    venue_type: string | null;
    lat: number;
    lng: number;
    image_url: string | null;
    short_description: string | null;
    vibes: string[] | null;
    hours: HoursData | null;
    city: string | null;
  };

  const allVenues = venuesRaw as VenueRow[];
  const venueMap = new Map(allVenues.map((v) => [v.id, v]));

  // IDs for event-hosting venues (broader than suggestion types)
  const eventVenueIds = allVenues
    .filter((v) => EVENT_VENUE_TYPES.has(v.venue_type ?? ""))
    .map((v) => v.id);

  // -----------------------------------------------------------------------
  // Parallel: fetch specials + nearby events for anchor date
  // -----------------------------------------------------------------------

  const anchorDayOfWeek = new Date(`${anchorDate}T12:00:00Z`).getUTCDay();
  const suggestionVenueIds = allVenues
    .filter((v) => VENUE_SUGGESTION_TYPES.has(v.venue_type ?? ""))
    .map((v) => v.id);

  // Determine if after-slot window crosses midnight (need next-day events)
  const afterSlotCrossesMidnight = anchorEndH * 60 + anchorEndM + 180 >= 1440;
  const nextDate = (() => {
    if (!afterSlotCrossesMidnight) return null;
    const d = new Date(`${anchorDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  // Build event query
  let eventQuery = supabase
    .from("events")
    .select("id, title, category_id, start_time, end_time, image_url, is_free, tags, venue_id")
    .eq("is_active", true)
    .not("start_time", "is", null)
    .limit(100);

  // Query anchor date + next date if after-slot crosses midnight
  if (nextDate) {
    eventQuery = eventQuery.in("start_date", [anchorDate, nextDate]);
  } else {
    eventQuery = eventQuery.eq("start_date", anchorDate);
  }

  if (eventVenueIds.length > 0) {
    eventQuery = eventQuery.in("venue_id", eventVenueIds);
  } else {
    // No event-hosting venues nearby — skip event query
    eventQuery = eventQuery.eq("id", -1); // no-op filter
  }

  // Exclude the anchor event itself
  if (anchorEventId) {
    const parsedId = parseInt(anchorEventId, 10);
    if (!isNaN(parsedId)) {
      eventQuery = eventQuery.neq("id", parsedId);
    }
  }
  eventQuery = applyFeedGate(eventQuery);

  const [{ data: specials }, { data: nearbyEvents }] = await Promise.all([
    supabase
      .from("venue_specials")
      .select("id, venue_id, title, type, days_of_week, time_start, time_end")
      .eq("is_active", true)
      .in("venue_id", suggestionVenueIds.length > 0 ? suggestionVenueIds : [-1])
      .contains("days_of_week", [anchorDayOfWeek])
      .limit(500),
    eventQuery,
  ]);

  const specialsByVenue = new Map<number, { title: string; type: string }>();
  if (specials) {
    for (const s of specials as { id: number; venue_id: number; title: string; type: string }[]) {
      if (!specialsByVenue.has(s.venue_id)) {
        specialsByVenue.set(s.venue_id, { title: s.title, type: s.type });
      }
    }
  }

  type EventRow = {
    id: number;
    title: string;
    category_id: string | null;
    start_time: string;
    end_time: string | null;
    image_url: string | null;
    is_free: boolean;
    tags: string[] | null;
    venue_id: number;
  };

  const events = (nearbyEvents ?? []) as EventRow[];

  // -----------------------------------------------------------------------
  // Shared helpers
  // -----------------------------------------------------------------------

  const categoryFilter = categoriesFilter
    ? new Set(categoriesFilter.split(",").map((c) => c.trim()))
    : null;

  const seenNames = new Set<string>();

  /** Compute meal label for food fallback reason text */
  function getMealLabel(direction: "before" | "after"): string {
    if (direction === "before") {
      const h = anchorH - 1;
      if (h < 11) return "brunch";
      if (h < 17) return "lunch";
      return "dinner";
    }
    // After-slot: base on when the user would actually be eating (anchor end + buffer)
    const afterH = anchorEndM >= 45 ? (anchorEndH + 1) % 24 : anchorEndH;
    if (afterH >= 21 || afterH < 4) return "late-night";
    return "dinner";
  }

  /** Build venue candidates — pass 1 uses lenient base-time hours check */
  function buildVenueCandidates(
    direction: "before" | "after",
    baseTargetHHMM: string,
  ): (OutingSuggestion & { _hhmm?: string })[] {
    const candidates: (OutingSuggestion & { _hhmm?: string })[] = [];
    const mealLabel = getMealLabel(direction);

    for (const venue of allVenues) {
      // Only allow venue-suggestion types
      if (!VENUE_SUGGESTION_TYPES.has(venue.venue_type ?? "")) continue;

      if (venue.lat == null || venue.lng == null) continue;

      const normalizedName = venue.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seenNames.has(normalizedName)) continue;
      seenNames.add(normalizedName);

      const distKm = haversineDistanceKm(anchorLat!, anchorLng!, venue.lat, venue.lng);
      if (distKm > radiusKm) continue;

      const walkMin = getWalkingMinutes(distKm);
      const category = categorizeVenue(venue.venue_type);

      if (categoryFilter && !categoryFilter.has(category)) continue;

      const openCheck = venue.hours
        ? isOpenAtTime(venue.hours, anchorDayOfWeek, baseTargetHHMM)
        : { isOpen: true };
      if (!openCheck.isOpen) continue;

      const special = specialsByVenue.get(venue.id) ?? null;

      candidates.push({
        type: "venue",
        id: venue.id,
        title: venue.name,
        venue: {
          id: venue.id,
          name: venue.name,
          slug: venue.slug,
          lat: venue.lat,
          lng: venue.lng,
          venue_type: venue.venue_type,
        },
        suggested_time: "",
        distance_km: Math.round(distKm * 100) / 100,
        walking_minutes: walkMin,
        reason: buildVenueReason(category, walkMin, venue, special?.title, mealLabel),
        category,
        image_url: venue.image_url,
        active_special: special,
      });
    }

    return candidates;
  }

  /** Build event candidates for a given time window */
  function buildEventCandidates(
    direction: "before" | "after",
  ): (OutingSuggestion & { _hhmm?: string })[] {
    const candidates: (OutingSuggestion & { _hhmm?: string })[] = [];

    // Compute time window for this slot
    const anchorEndStr = formatTimeHHMM(anchorEndH, anchorEndM);
    const windowStart = direction === "before"
      ? addMinutesToHHMM(anchorTime!, -240) // 4h before anchor
      : anchorEndStr;                        // from anchor end
    const windowEnd = direction === "before"
      ? addMinutesToHHMM(anchorTime!, -60)  // 1h before anchor
      : addMinutesToHHMM(anchorEndStr, 180); // 3h after anchor end

    const anchorStartMin = anchorH * 60 + anchorM;
    const anchorEndMin = anchorEndH * 60 + anchorEndM;
    const MIN_EVENT_ATTENDANCE = 45; // minutes worth attending an event before leaving

    for (const event of events) {
      if (!event.start_time) continue;

      // Time window filter
      if (!isTimeInWindow(event.start_time, windowStart, windowEnd)) continue;

      // Category filter
      if (categoryFilter && !categoryFilter.has("events")) continue;

      const venue = venueMap.get(event.venue_id);
      if (!venue || venue.lat == null || venue.lng == null) continue;

      const distKm = haversineDistanceKm(anchorLat!, anchorLng!, venue.lat, venue.lng);
      if (distKm > radiusKm) continue;

      const walkMin = getWalkingMinutes(distKm);
      const eventStartMin = hhmmToMinutes(event.start_time);

      if (direction === "before") {
        // Before-slot: if event has end_time, require it to fully end with walk buffer
        // Otherwise fall back to MIN_EVENT_ATTENDANCE heuristic
        if (event.end_time) {
          const eventEndMin = hhmmToMinutes(event.end_time);
          const gapEndToAnchor = ((anchorStartMin - eventEndMin) % 1440 + 1440) % 1440;
          if (gapEndToAnchor < walkMin || gapEndToAnchor > 720) continue;
        } else {
          const gapToAnchor = ((anchorStartMin - eventStartMin) % 1440 + 1440) % 1440;
          if (gapToAnchor < MIN_EVENT_ATTENDANCE + walkMin) continue;
        }
      } else {
        // After-slot: ensure enough walk time from anchor to reach the event
        const gapFromAnchor = ((eventStartMin - anchorEndMin) % 1440 + 1440) % 1440;
        if (gapFromAnchor < walkMin) continue;
      }

      candidates.push({
        type: "event",
        id: event.id,
        title: event.title,
        venue: {
          id: venue.id,
          name: venue.name,
          slug: venue.slug,
          lat: venue.lat,
          lng: venue.lng,
          venue_type: venue.venue_type,
        },
        suggested_time: formatTimeDisplay(event.start_time),
        distance_km: Math.round(distKm * 100) / 100,
        walking_minutes: walkMin,
        reason: buildEventReason(event, walkMin, venue.name),
        category: "events",
        image_url: event.image_url ?? venue.image_url,
        active_special: null,
        _hhmm: event.start_time,
      });
    }

    return candidates;
  }

  /** Quality ranking — images > hours data > distance */
  function rankSuggestions(list: (OutingSuggestion & { _hhmm?: string })[]) {
    list.sort((a, b) => {
      const aImg = a.image_url ? 1 : 0;
      const bImg = b.image_url ? 1 : 0;
      if (aImg !== bImg) return bImg - aImg;

      // Events get a slight boost (more actionable than generic venues)
      const aEvent = a.type === "event" ? 1 : 0;
      const bEvent = b.type === "event" ? 1 : 0;
      if (aEvent !== bEvent) return bEvent - aEvent;

      const aVenue = venueMap.get(a.venue.id);
      const bVenue = venueMap.get(b.venue.id);
      const aHours = aVenue?.hours ? 1 : 0;
      const bHours = bVenue?.hours ? 1 : 0;
      if (aHours !== bHours) return bHours - aHours;

      return a.distance_km - b.distance_km;
    });
  }

  // Category-aware venue duration
  const CATEGORY_DURATION: Record<string, number> = {
    food: 75,
    drinks: 45,
    activity: 60,
    sight: 30,
  };

  /** Assign suggested times, then run pass-2 hours check + overflow cap */
  function computeSuggestionsForSlot(
    direction: "before" | "after",
    candidates: (OutingSuggestion & { _hhmm?: string })[],
  ): OutingSuggestion[] {
    const anchorEndTimeStr = formatTimeHHMM(anchorEndH, anchorEndM);

    // Assign suggested_time for venue candidates (events already have theirs)
    let venueIdx = 0;
    for (let i = 0; i < candidates.length; i++) {
      const s = candidates[i];

      // Events use their actual start time (already set in buildEventCandidates)
      if (s.type === "event") continue;

      if (direction === "before") {
        const duration = CATEGORY_DURATION[s.category] ?? 60;
        const arriveMinutes = -(s.walking_minutes + duration);
        const hhmm = addMinutesToHHMM(anchorTime!, arriveMinutes);
        s._hhmm = hhmm;
        s.suggested_time = formatTimeDisplay(hhmm);
      } else {
        const stagger = Math.min(venueIdx * 10, 60);
        const arriveMinutes = s.walking_minutes + stagger;
        const hhmm = addMinutesToHHMM(anchorEndTimeStr, arriveMinutes);
        s._hhmm = hhmm;
        s.suggested_time = formatTimeDisplay(hhmm);
      }
      venueIdx++;
    }

    // Pass 2: per-suggestion verification
    const verified: OutingSuggestion[] = [];
    const keptCoords: { lat: number; lng: number }[] = [];

    for (const s of candidates) {
      // Two-pass hours check for venues (events are at fixed times, always valid)
      if (s.type === "venue" && s._hhmm) {
        const [sH] = s._hhmm.split(":").map(Number);
        const baseH = direction === "before" ? anchorH : anchorEndH;
        const suggestionDay = sH < baseH && direction === "after"
          ? (anchorDayOfWeek + 1) % 7
          : anchorDayOfWeek;

        const rawVenue = venueMap.get(s.id);
        if (rawVenue?.hours) {
          const openCheck = isOpenAtTime(rawVenue.hours, suggestionDay, s._hhmm);
          if (!openCheck.isOpen) continue;

          // Verify venue stays open long enough for the activity
          if (openCheck.closesAt) {
            const arrivalMin = hhmmToMinutes(s._hhmm);
            const closeMin = hhmmToMinutes(openCheck.closesAt);
            const adjustedClose = closeMin <= arrivalMin ? closeMin + 1440 : closeMin;
            const requiredDuration = CATEGORY_DURATION[s.category] ?? 60;
            if (adjustedClose - arrivalMin < requiredDuration) continue;
          }
        }
      }

      // Before-slot overflow cap: filter out arrivals >= anchor time
      if (direction === "before" && s._hhmm) {
        const [sH, sM] = s._hhmm.split(":").map(Number);
        const suggestMin = sH * 60 + sM;
        const anchorMin = anchorH * 60 + anchorM;
        const forwardGap = ((anchorMin - suggestMin) % 1440 + 1440) % 1440;
        if (forwardGap === 0 || forwardGap > 720) continue;
      }

      // Coordinate-proximity dedup: skip venues within 20m of one already kept
      if (s.venue.lat != null && s.venue.lng != null) {
        const tooClose = keptCoords.some(
          (c) => haversineDistanceKm(c.lat, c.lng, s.venue.lat!, s.venue.lng!) < 0.02,
        );
        if (tooClose) continue;
        keptCoords.push({ lat: s.venue.lat, lng: s.venue.lng });
      }

      const { _hhmm: _, ...clean } = s;
      verified.push(clean);
    }

    const limit = direction === "before" ? 10 : 20;
    return verified.slice(0, limit);
  }

  // -----------------------------------------------------------------------
  // Compute base target times
  // -----------------------------------------------------------------------

  function computeBaseTarget(direction: "before" | "after"): { h: number; m: number; hhmm: string } {
    if (direction === "before") {
      const total = ((anchorH * 60 + anchorM - 90) % 1440 + 1440) % 1440;
      const h = Math.floor(total / 60);
      const m = total % 60;
      return { h, m, hhmm: formatTimeHHMM(h, m) };
    }
    const total = (anchorEndH * 60 + anchorEndM + 15) % 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return { h, m, hhmm: formatTimeHHMM(h, m) };
  }

  // -----------------------------------------------------------------------
  // Compute per-slot results
  // -----------------------------------------------------------------------

  const slotsToCompute: ("before" | "after")[] =
    slot === "both" ? ["before", "after"] : [slot as "before" | "after"];

  const results: Record<string, { suggestions: OutingSuggestion[]; target_time: string }> = {};

  for (const direction of slotsToCompute) {
    seenNames.clear();

    const baseTarget = computeBaseTarget(direction);

    // Build venue + event candidates separately
    const venueCandidates = buildVenueCandidates(direction, baseTarget.hhmm);
    const eventCandidates = buildEventCandidates(direction);

    // Dedup: if an event exists at a venue, prefer the event (more actionable)
    const eventVenueIdSet = new Set(eventCandidates.map((e) => e.venue.id));
    const dedupedVenues = venueCandidates.filter((v) => !eventVenueIdSet.has(v.venue.id));

    // Merge and rank together
    const allCandidates = [...dedupedVenues, ...eventCandidates];
    rankSuggestions(allCandidates);
    const final = computeSuggestionsForSlot(direction, allCandidates);

    results[direction] = {
      suggestions: final,
      target_time: formatTimeDisplay(baseTarget.hhmm),
    };
  }

  // -----------------------------------------------------------------------
  // Cross-slot dedup — only remove same-category duplicates
  // -----------------------------------------------------------------------

  if (slot === "both" && results.before && results.after) {
    const beforeByCat = new Map<string, Set<number>>();
    for (const s of results.before.suggestions) {
      const key = s.type === "event" ? `event:${s.category}` : s.category;
      if (!beforeByCat.has(key)) beforeByCat.set(key, new Set());
      beforeByCat.get(key)!.add(s.type === "event" ? s.id : s.venue.id);
    }
    results.after.suggestions = results.after.suggestions.filter((s) => {
      const key = s.type === "event" ? `event:${s.category}` : s.category;
      const id = s.type === "event" ? s.id : s.venue.id;
      return !beforeByCat.get(key)?.has(id);
    });
  }

  // -----------------------------------------------------------------------
  // Return response
  // -----------------------------------------------------------------------

  const cacheHeaders = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

  if (slot === "both") {
    return NextResponse.json(
      {
        before: results.before?.suggestions ?? [],
        after: results.after?.suggestions ?? [],
        target_time_before: results.before?.target_time ?? "",
        target_time_after: results.after?.target_time ?? "",
      },
      { headers: cacheHeaders },
    );
  }

  const direction = slot as "before" | "after";
  return NextResponse.json(
    {
      suggestions: results[direction]?.suggestions ?? [],
      slot,
      target_time: results[direction]?.target_time ?? "",
    },
    { headers: cacheHeaders },
  );
}
