/**
 * GET /api/portals/[slug]/outing-suggestions
 *
 * Smart suggestions for before/after activities near an anchor event.
 * Used by the Outing Builder to help users plan a full evening out.
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

function categorizeVenue(venueType: string | null): "food" | "drinks" | "activity" | "sight" {
  if (!venueType) return "activity";
  const type = venueType.toLowerCase();
  const foodTypes = new Set(["restaurant", "cafe", "bakery", "diner", "pizzeria", "food_hall", "food_truck"]);
  const drinkTypes = new Set(["bar", "brewery", "winery", "cocktail_bar", "sports_bar", "nightclub", "rooftop", "pub", "taproom", "distillery"]);
  const sightTypes = new Set(["museum", "gallery", "park", "garden", "botanical_garden", "historic_site", "landmark"]);
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
  const anchorTime = searchParams.get("anchor_time"); // HH:MM
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

  const supabase = await createClient();

  // Verify portal exists
  const { data: portalData } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!portalData) {
    return errorResponse("Portal not found", "outing-suggestions", 404);
  }

  // -----------------------------------------------------------------------
  // Find nearby venues using bounding box
  // -----------------------------------------------------------------------

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((anchorLat * Math.PI) / 180), 0.01));

  const { data: venues } = await supabase
    .from("venues")
    .select(`
      id, name, slug, address, neighborhood, venue_type,
      lat, lng, image_url, short_description, hours
    `)
    .neq("active", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .gte("lat", anchorLat - latDelta)
    .lte("lat", anchorLat + latDelta)
    .gte("lng", anchorLng - lngDelta)
    .lte("lng", anchorLng + lngDelta)
    .limit(200);

  if (!venues || venues.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // -----------------------------------------------------------------------
  // Determine target time window
  // -----------------------------------------------------------------------

  let targetH: number;
  let targetM: number;

  if (slot === "before") {
    // 2 hours before the event
    const totalMinutes = anchorH * 60 + anchorM - 120;
    targetH = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
    targetM = ((totalMinutes % 1440) + 1440) % 60;
  } else {
    // Event end estimate: anchor + 2 hours
    const totalMinutes = anchorH * 60 + anchorM + 120;
    targetH = Math.floor((totalMinutes % 1440) / 60);
    targetM = totalMinutes % 60;
  }

  const targetTimeStr = formatTimeHHMM(targetH, targetM);
  const targetDate = new Date(`${anchorDate}T${targetTimeStr}:00`);

  // -----------------------------------------------------------------------
  // Fetch active specials for nearby venues
  // -----------------------------------------------------------------------

  const venueIds = venues.map((v: { id: number }) => v.id);
  const { data: specials } = await supabase
    .from("venue_specials")
    .select("id, venue_id, title, type, days_of_week, time_start, time_end")
    .eq("is_active", true)
    .in("venue_id", venueIds)
    .limit(500);

  const specialsByVenue = new Map<number, { title: string; type: string }>();
  if (specials) {
    for (const s of specials as { id: number; venue_id: number; title: string; type: string }[]) {
      // Just take the first active special per venue
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

    // Check if open at target time
    const openCheck = isOpenAt(venue.hours, targetDate);
    if (!openCheck.isOpen) continue;

    const special = specialsByVenue.get(venue.id) ?? null;

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
      suggested_time: formatTimeDisplay(targetTimeStr),
      distance_km: Math.round(distKm * 100) / 100,
      walking_minutes: walkMin,
      reason: buildReason(category, walkMin, special?.title),
      category,
      image_url: venue.image_url,
      active_special: special,
    });
  }

  // Sort by proximity
  suggestions.sort((a, b) => a.distance_km - b.distance_km);

  // Limit results
  const limited = suggestions.slice(0, 20);

  return NextResponse.json(
    { suggestions: limited, slot, target_time: formatTimeDisplay(targetTimeStr) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
