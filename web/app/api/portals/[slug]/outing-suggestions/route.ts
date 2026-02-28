/**
 * GET /api/portals/[slug]/outing-suggestions
 *
 * Smart suggestions for before/after activities near an anchor event.
 * Used by the "Make a Night of It" bottom sheet on event detail.
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
import { isOpenAt, type HoursData } from "@/lib/hours";
import { expandCityFilterForMetro } from "@/lib/portal-scope";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string }> };

type OutingSuggestion = {
  type: "venue" | "event" | "special";
  id: number;
  title: string;
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number | null;
    lng: number | null;
    venue_type: string | null;
  };
  suggested_time: string;
  distance_km: number;
  walking_minutes: number;
  reason: string;
  category: "food" | "drinks" | "activity" | "sight";
  image_url: string | null;
  active_special?: { title: string; type: string } | null;
};

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

/** Venue types allowed in suggestions — no nonprofits, churches, community orgs */
const ALLOWED_VENUE_TYPES = new Set([
  // Food
  "restaurant", "cafe", "bakery", "diner", "pizzeria", "food_hall",
  // Drinks
  "bar", "brewery", "winery", "cocktail_bar", "sports_bar", "nightclub",
  "rooftop", "pub", "taproom", "distillery",
  // Activities
  "museum", "gallery", "park", "arcade", "bowling", "karaoke", "eatertainment",
]);

function categorizeVenue(venueType: string | null): "food" | "drinks" | "activity" | "sight" {
  if (!venueType) return "activity";
  const type = venueType.toLowerCase();
  const foodTypes = new Set(["restaurant", "cafe", "bakery", "diner", "pizzeria", "food_hall"]);
  const drinkTypes = new Set(["bar", "brewery", "winery", "cocktail_bar", "sports_bar", "nightclub", "rooftop", "pub", "taproom", "distillery"]);
  const sightTypes = new Set(["museum", "gallery", "park"]);
  if (foodTypes.has(type)) return "food";
  if (drinkTypes.has(type)) return "drinks";
  if (sightTypes.has(type)) return "sight";
  return "activity";
}

function buildReason(category: string, walkMin: number, specialTitle?: string | null): string {
  const walkLabel = walkMin <= 2 ? "right next door" : `${walkMin} min walk`;
  const categoryLabel =
    category === "food" ? "Great dinner spot" :
    category === "drinks" ? "Perfect for drinks" :
    category === "sight" ? "Worth a visit" :
    "Fun activity";
  const parts = [categoryLabel, walkLabel];
  if (specialTitle) parts.push(specialTitle);
  return parts.join(", ");
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
  const slot = searchParams.get("slot"); // "before" | "after"
  const categoriesFilter = searchParams.get("categories");
  const radiusKm = parseFloatParam(searchParams.get("radius_km"), 2) ?? 2;

  if (anchorLat === null || anchorLng === null || !anchorTime || !anchorDate || !slot) {
    return validationError("anchor_lat, anchor_lng, anchor_time, anchor_date, and slot are required");
  }

  if (slot !== "before" && slot !== "after") {
    return validationError("slot must be 'before' or 'after'");
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
  // Find nearby venues using bounding box + venue type allowlist + city scope
  // -----------------------------------------------------------------------

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((anchorLat * Math.PI) / 180), 0.01));

  let venueQuery = supabase
    .from("venues")
    .select(`
      id, name, slug, address, neighborhood, venue_type,
      lat, lng, image_url, short_description, hours, city
    `)
    .neq("active", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .gte("lat", anchorLat - latDelta)
    .lte("lat", anchorLat + latDelta)
    .gte("lng", anchorLng - lngDelta)
    .lte("lng", anchorLng + lngDelta)
    .in("venue_type", Array.from(ALLOWED_VENUE_TYPES))
    .limit(200);

  // Bug fix #3: Scope to portal city to prevent cross-city leakage
  if (portalCities.length > 0) {
    venueQuery = venueQuery.in("city", portalCities);
  }

  const { data: venues } = await venueQuery;

  if (!venues || venues.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // -----------------------------------------------------------------------
  // Determine base target time for the slot
  // -----------------------------------------------------------------------

  let baseTargetH: number;
  let baseTargetM: number;

  if (slot === "before") {
    // Start suggesting ~90 min before the event (time to eat + walk)
    const totalMinutes = anchorH * 60 + anchorM - 90;
    baseTargetH = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
    baseTargetM = ((totalMinutes % 1440) + 1440) % 60;
  } else {
    // Start suggesting from event end + walk time
    const totalMinutes = anchorEndH * 60 + anchorEndM + 15;
    baseTargetH = Math.floor((totalMinutes % 1440) / 60);
    baseTargetM = totalMinutes % 60;
  }

  const baseTargetTimeStr = formatTimeHHMM(baseTargetH, baseTargetM);
  const targetDate = new Date(`${anchorDate}T${baseTargetTimeStr}:00`);

  // -----------------------------------------------------------------------
  // Fetch active specials for nearby venues, filtered by day of week
  // -----------------------------------------------------------------------

  const anchorDayOfWeek = new Date(`${anchorDate}T12:00:00`).getDay(); // 0=Sun..6=Sat
  const venueIds = venues.map((v: { id: number }) => v.id);
  const { data: specials } = await supabase
    .from("venue_specials")
    .select("id, venue_id, title, type, days_of_week, time_start, time_end")
    .eq("is_active", true)
    .in("venue_id", venueIds)
    .contains("days_of_week", [anchorDayOfWeek])
    .limit(500);

  const specialsByVenue = new Map<number, { title: string; type: string }>();
  if (specials) {
    for (const s of specials as { id: number; venue_id: number; title: string; type: string }[]) {
      if (!specialsByVenue.has(s.venue_id)) {
        specialsByVenue.set(s.venue_id, { title: s.title, type: s.type });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Score and filter venues
  // -----------------------------------------------------------------------

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
    hours: HoursData | null;
    city: string | null;
  };

  const suggestions: OutingSuggestion[] = [];
  const categoryFilter = categoriesFilter
    ? new Set(categoriesFilter.split(",").map((c) => c.trim()))
    : null;

  for (const venue of venues as VenueRow[]) {
    if (!venue.lat || !venue.lng) continue;

    const distKm = haversineDistanceKm(anchorLat, anchorLng, venue.lat, venue.lng);
    if (distKm > radiusKm) continue;

    const walkMin = getWalkingMinutes(distKm);
    const category = categorizeVenue(venue.venue_type);

    // Apply category filter
    if (categoryFilter && !categoryFilter.has(category)) continue;

    // Check if open at target time. Venues with no hours data are assumed open.
    const openCheck = venue.hours ? isOpenAt(venue.hours, targetDate) : { isOpen: true };
    if (!openCheck.isOpen) continue;

    const special = specialsByVenue.get(venue.id) ?? null;

    // Bug fix #1: Compute per-suggestion time based on walk time + stagger
    // Before: arrive at venue = event start - walk time - 60min dining
    // After: arrive at venue = event end + walk time
    const staggerMinutes = suggestions.length * 15;
    let perSuggestionTime: string;
    if (slot === "before") {
      const arriveMinutes = -(walkMin + 60) + staggerMinutes;
      perSuggestionTime = addMinutesToHHMM(anchorTime, arriveMinutes);
    } else {
      const arriveMinutes = walkMin + staggerMinutes;
      perSuggestionTime = addMinutesToHHMM(
        formatTimeHHMM(anchorEndH, anchorEndM),
        arriveMinutes,
      );
    }

    suggestions.push({
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
      suggested_time: formatTimeDisplay(perSuggestionTime),
      distance_km: Math.round(distKm * 100) / 100,
      walking_minutes: walkMin,
      reason: buildReason(category, walkMin, special?.title),
      category,
      image_url: venue.image_url,
      active_special: special,
    });
  }

  // Bug fix #5: Quality ranking — venues with images + hours data first, then by distance
  suggestions.sort((a, b) => {
    const aImg = a.image_url ? 1 : 0;
    const bImg = b.image_url ? 1 : 0;
    if (aImg !== bImg) return bImg - aImg; // image first

    // Find the raw venue for hours check
    const aVenue = (venues as VenueRow[]).find((v) => v.id === a.id);
    const bVenue = (venues as VenueRow[]).find((v) => v.id === b.id);
    const aHours = aVenue?.hours ? 1 : 0;
    const bHours = bVenue?.hours ? 1 : 0;
    if (aHours !== bHours) return bHours - aHours; // hours data first

    return a.distance_km - b.distance_km; // then closest
  });

  // Limit results
  const limited = suggestions.slice(0, 20);

  return NextResponse.json(
    { suggestions: limited, slot, target_time: formatTimeDisplay(baseTargetTimeStr) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
