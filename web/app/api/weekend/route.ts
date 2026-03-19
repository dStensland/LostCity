import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString, parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import { getPortalSourceAccess } from "@/lib/federation";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Atlanta center (Ponce City Market area)
const ATL_CENTER_LAT = 33.772;
const ATL_CENTER_LNG = -84.365;
// 10km radius for "easy_wins" section (~6.2 miles)
const EASY_WINS_RADIUS_KM = 10;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Return the Saturday–Sunday date range for the upcoming weekend.
// "Weekend" for a family portal means Sat and Sun only — not Friday.
// If today is Saturday, return today–Sunday.
// If today is Sunday, return today only (saturday = sunday = today).
// Mon–Fri: return the coming Saturday and Sunday.
function getWeekendRange(): { saturday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

  let daysToSaturday: number;
  if (day === 6) {
    // Today is Saturday
    daysToSaturday = 0;
  } else if (day === 0) {
    // Today is Sunday — show today as both bounds
    daysToSaturday = 0; // sunday = saturday below
  } else {
    // Mon–Fri: days until next Saturday
    daysToSaturday = 6 - day;
  }

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysToSaturday);

  let sunday: Date;
  if (day === 0) {
    // Today is Sunday — only show Sunday
    sunday = new Date(now);
  } else {
    sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
  }

  function fmt(d: Date): string {
    return d.toISOString().split("T")[0];
  }

  return { saturday: fmt(saturday), sunday: fmt(sunday) };
}

type VenueShape = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  venue_type: string | null;
} | null;

type WeekendEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category_id: string | null;
  tags: string[] | null;
  age_min: number | null;
  age_max: number | null;
  image_url: string | null;
  ticket_url: string | null;
  source_id: number | null;
  portal_id: string | null;
  venue: VenueShape;
};

const INDOOR_VENUE_TYPES = new Set([
  "museum",
  "gallery",
  "theater",
  "arts_center",
  "cinema",
  "library",
  "community_center",
  "recreation",
  "arcade",
  "eatertainment",
  "climbing_gym",
  "aquarium",
  "children_museum",
  "science_center",
  "escape_room",
]);

function isIndoorVenue(venue: VenueShape): boolean {
  if (!venue) return false;
  // Infer from venue_type (is_indoor column not yet in schema)
  return venue.venue_type ? INDOOR_VENUE_TYPES.has(venue.venue_type) : false;
}

function isNearAtlantaCenter(venue: VenueShape): boolean {
  if (!venue?.lat || !venue?.lng) return false;
  const km = haversineKm(ATL_CENTER_LAT, ATL_CENTER_LNG, venue.lat, venue.lng);
  return km <= EASY_WINS_RADIUS_KM;
}

// GET /api/weekend?portal=atlanta-families
// Returns family activities for the upcoming weekend (Sat–Sun)
// grouped into sections: best_bets, free, easy_wins, big_outings
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  const portalParam = searchParams.get("portal");
  if (!portalParam || !isValidString(portalParam, 1, 50)) {
    return NextResponse.json(
      { error: "portal parameter is required" },
      { status: 400 }
    );
  }

  const ageFilter = parseIntParam(searchParams.get("age"));
  const freeOnly = searchParams.get("free") === "true";
  const indoorOnly = searchParams.get("indoor") === "true";
  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 30, 100);

  try {
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request));

    if (!portalContext.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }

    const portalId = portalContext.portalId;
    const { saturday, sunday } = getWeekendRange();

    const sourceAccess = await getPortalSourceAccess(portalId);
    const sourceIds = sourceAccess?.sourceIds ?? [];

    // Use service client for broader read access (portal events + federated sources)
    const serviceClient = createServiceClient();

    const eventSelect = `
      id,
      title,
      start_date,
      end_date,
      start_time,
      end_time,
      is_all_day,
      is_free,
      price_min,
      price_max,
      category_id,
      tags,
      age_min,
      age_max,
      image_url,
      ticket_url,
      source_id,
      portal_id,
      venue:venues(id, name, slug, neighborhood, city, lat, lng, image_url, venue_type)
    `;

    // Build the portal source scope filter
    let scopeFilter: string;
    if (sourceIds.length > 0) {
      scopeFilter = `portal_id.eq.${portalId},source_id.in.(${sourceIds.join(",")})`;
    } else {
      scopeFilter = `portal_id.eq.${portalId}`;
    }

    let query = serviceClient
      .from("events")
      .select(eventSelect)
      .gte("start_date", saturday)
      .lte("start_date", sunday)
      .is("canonical_event_id", null)
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .or(scopeFilter)
      .order("start_date", { ascending: true })
      .order("is_free", { ascending: false })
      .limit(limit * 4); // Fetch more than needed for grouping

    if (freeOnly) {
      query = query.eq("is_free", true);
    }

    if (ageFilter !== null) {
      query = query
        .or(`age_min.is.null,age_min.lte.${ageFilter}`)
        .or(`age_max.is.null,age_max.gte.${ageFilter}`);
    }

    const { data: eventsData, error } = await query;

    if (error) {
      return errorResponse(error, "GET /api/weekend");
    }

    const allEvents = (eventsData ?? []) as WeekendEvent[];

    // Exclude events starting before 6:00 AM — these are never family activities
    // (volunteer graveyard shifts, overnight events, etc.).
    // All-day events have no start_time and are always included.
    function isReasonableHour(e: WeekendEvent): boolean {
      if (e.is_all_day || !e.start_time) return true;
      const hour = parseInt(e.start_time.split(":")[0] ?? "0", 10);
      return hour >= 6;
    }

    // Apply indoor filter post-query (derived from venue_type)
    const events = (indoorOnly
      ? allEvents.filter((e) => isIndoorVenue(e.venue))
      : allEvents
    ).filter(isReasonableHour);

    // De-duplicate by id
    const seen = new Set<number>();
    const unique: WeekendEvent[] = [];
    for (const e of events) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        unique.push(e);
      }
    }

    // Group into sections — each event can appear in multiple groups
    // but we cap each section at `limit`

    // best_bets: events with images, ordered as-is (natural DB order = start_date + is_free)
    const bestBets = unique
      .filter((e) => e.image_url)
      .slice(0, limit);

    // free: free events only
    const free = unique
      .filter((e) => e.is_free)
      .slice(0, limit);

    // easy_wins: events at venues within 10km of Atlanta center
    const easyWins = unique
      .filter((e) => isNearAtlantaCenter(e.venue))
      .slice(0, limit);

    // big_outings: events NOT near Atlanta center (further destinations)
    const bigOutings = unique
      .filter(
        (e) =>
          e.venue?.lat &&
          e.venue?.lng &&
          !isNearAtlantaCenter(e.venue)
      )
      .slice(0, limit);

    return NextResponse.json(
      {
        weekend: { saturday, sunday },
        total: unique.length,
        sections: {
          best_bets: bestBets,
          free,
          easy_wins: easyWins,
          big_outings: bigOutings,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/weekend");
  }
}
