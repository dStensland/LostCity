/**
 * GET /api/portals/[slug]/destinations
 *
 * Returns ~20 enriched places with lens metadata for the contextual
 * Destinations section (Phase 2 feed redesign).
 *
 * Two-query strategy (parallel via Promise.all):
 *   Query A — ~30 active places with nested profile + vertical_details joins
 *   Query B — closing exhibitions within 14 days
 *
 * Response includes lensAvailability so the client can decide which
 * lens pills to render without a second round-trip.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { normalizePortalSlug, resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { isOpenAtTime, type HoursData } from "@/lib/hours";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DestinationV2Item {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  place_type: string | null;
  image_url: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  is_open: boolean | null;
  created_at: string;
  indoor_outdoor: string | null;
  wheelchair: boolean | null;
  family_suitability: string | null;
  short_description: string | null;
  closing_exhibition?: { title: string; days_remaining: number } | null;
}

export interface DestinationsV2Response {
  destinations: DestinationV2Item[];
  lensAvailability: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

type PlaceProfileJoin = {
  hero_image_url: string | null;
  short_description: string | null;
  wheelchair_accessible: boolean | null;
  family_suitability: string | null;
};

type PlaceVerticalDetailsJoin = {
  google: {
    rating: number | null;
    rating_count: number | null;
  } | null;
};

type PlaceRow = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  place_type: string | null;
  image_url: string | null;
  hours: HoursData | null;
  indoor_outdoor: string | null;
  created_at: string;
  place_profile: PlaceProfileJoin[] | null;
  place_vertical_details: PlaceVerticalDetailsJoin[] | null;
};

type ExhibitionRow = {
  id: string;
  title: string;
  closing_date: string;
  place_id: number;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scorePlace(place: PlaceRow): number {
  let score = 0;
  const profile = place.place_profile?.[0] ?? null;
  const vertDetails = place.place_vertical_details?.[0] ?? null;

  const hasImage = !!(place.image_url || profile?.hero_image_url);
  const hasRating = !!(vertDetails?.google?.rating);
  const hasDescription = !!profile?.short_description;
  const isNew =
    !!place.created_at &&
    Date.now() - new Date(place.created_at).getTime() < 90 * 24 * 60 * 60 * 1000;

  if (hasImage) score += 10;
  if (hasRating) score += 8;
  if (hasDescription) score += 5;
  if (isNew) score += 3;

  return score;
}

// ---------------------------------------------------------------------------
// Local time helpers (Vercel runs UTC — compute ET wall-clock time)
// ---------------------------------------------------------------------------

function getETWallClock(now: Date): { dayOfWeek: number; timeHHMM: string } {
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = etFormatter.formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minutePart = parts.find((p) => p.type === "minute")?.value ?? "00";
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Sun";

  const WEEKDAYS: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const hour = parseInt(hourPart, 10);
  const dayOfWeek = WEEKDAYS[weekdayPart] ?? 0;
  const timeHHMM = `${hour.toString().padStart(2, "0")}:${minutePart.padStart(2, "0")}`;

  return { dayOfWeek, timeHHMM };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ slug: string }> };

export const revalidate = 300; // 5-minute ISR

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);

  const supabase = await createClient();

  // Resolve portal to get city filter
  const { data: portalData } = await supabase
    .from("portals")
    .select("id, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle() as unknown as {
      data: { id: string; filters: Record<string, unknown> | string | null } | null;
    };

  if (!portalData) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Parse city from portal filters
  let portalCity = "Atlanta"; // safe default
  try {
    const filters =
      typeof portalData.filters === "string"
        ? JSON.parse(portalData.filters)
        : portalData.filters ?? {};
    if (filters.city && typeof filters.city === "string") {
      portalCity = filters.city;
    }
  } catch {
    // keep default
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Compute ET wall-clock time for open/close detection
  const { dayOfWeek: etDayOfWeek, timeHHMM: etTimeHHMM } = getETWallClock(now);

  // ---------------------------------------------------------------------------
  // Two parallel queries
  // ---------------------------------------------------------------------------

  const [placesResult, exhibitionsResult] = await Promise.all([
    supabase
      .from("places")
      .select(
        `id, name, slug, neighborhood, place_type, image_url, hours, indoor_outdoor, created_at,
         place_profile(hero_image_url, short_description, wheelchair_accessible, family_suitability),
         place_vertical_details(google)`,
      )
      .eq("is_active", true)
      .eq("city", portalCity)
      .limit(30) as unknown as Promise<{
        data: PlaceRow[] | null;
        error: { message: string } | null;
      }>,

    supabase
      .from("exhibitions")
      .select("id, title, closing_date, place_id")
      .gte("closing_date", today)
      .lte("closing_date", fourteenDaysFromNow)
      .limit(10) as unknown as Promise<{
        data: ExhibitionRow[] | null;
        error: { message: string } | null;
      }>,
  ]);

  const places: PlaceRow[] = placesResult.data ?? [];
  const exhibitions: ExhibitionRow[] = exhibitionsResult.data ?? [];

  // ---------------------------------------------------------------------------
  // Build exhibition lookup by place_id
  // ---------------------------------------------------------------------------

  const exhibitionByPlaceId = new Map<number, ExhibitionRow>();
  for (const ex of exhibitions) {
    if (!exhibitionByPlaceId.has(ex.place_id)) {
      exhibitionByPlaceId.set(ex.place_id, ex);
    }
  }

  // ---------------------------------------------------------------------------
  // Process places into DestinationV2Item
  // ---------------------------------------------------------------------------

  const processed: Array<DestinationV2Item & { _score: number }> = places.map((place) => {
    const profile = place.place_profile?.[0] ?? null;
    const vertDetails = place.place_vertical_details?.[0] ?? null;

    const googleRating = vertDetails?.google?.rating ?? null;
    const googleRatingCount = vertDetails?.google?.rating_count ?? null;

    // Open/closed via ET wall-clock time
    let isOpen: boolean | null = null;
    if (place.hours) {
      const { isOpen: open } = isOpenAtTime(
        place.hours,
        etDayOfWeek,
        etTimeHHMM,
      );
      isOpen = open;
    }

    // Closing exhibition
    const matchedEx = exhibitionByPlaceId.get(place.id) ?? null;
    let closingExhibition: { title: string; days_remaining: number } | null = null;
    if (matchedEx) {
      const closingMs = new Date(matchedEx.closing_date + "T23:59:59").getTime();
      const daysRemaining = Math.max(
        0,
        Math.ceil((closingMs - now.getTime()) / (1000 * 60 * 60 * 24)),
      );
      closingExhibition = { title: matchedEx.title, days_remaining: daysRemaining };
    }

    const item: DestinationV2Item & { _score: number } = {
      id: place.id,
      name: place.name,
      slug: place.slug,
      neighborhood: place.neighborhood,
      place_type: place.place_type,
      image_url: place.image_url,
      google_rating: googleRating,
      google_rating_count: googleRatingCount,
      is_open: isOpen,
      created_at: place.created_at,
      indoor_outdoor: place.indoor_outdoor,
      wheelchair: profile?.wheelchair_accessible ?? null,
      family_suitability: profile?.family_suitability ?? null,
      short_description: profile?.short_description ?? null,
      closing_exhibition: closingExhibition,
      _score: scorePlace(place),
    };

    return item;
  });

  // Sort by score descending, take top 20
  processed.sort((a, b) => b._score - a._score);
  const top20 = processed.slice(0, 20);

  // Strip internal _score field
  const destinations: DestinationV2Item[] = top20.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ _score, ...item }) => item,
  );

  // ---------------------------------------------------------------------------
  // Compute lens availability from the full processed set (not just top 20)
  // ---------------------------------------------------------------------------

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const closingCount = processed.filter((d) => d.closing_exhibition != null).length;
  const newCount = processed.filter(
    (d) => d.created_at && new Date(d.created_at) >= thirtyDaysAgo,
  ).length;
  const openCount = processed.filter(
    (d) => d.is_open === true,
  ).length;
  const ratedCount = processed.filter(
    (d) => d.google_rating != null,
  ).length;

  const lensAvailability: Record<string, boolean> = {
    weather: true, // always available — uses indoor_outdoor field
    closing_soon: closingCount >= 1,
    new: newCount >= 3,
    open_now: openCount >= 5,
    top_rated: ratedCount >= 6,
  };

  const response: DestinationsV2Response = { destinations, lensAvailability };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
