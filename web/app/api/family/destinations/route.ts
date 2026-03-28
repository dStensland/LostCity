import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { isValidString, parseIntParam } from "@/lib/api-utils";
import { applyPortalScopeToQuery } from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/family/destinations
 *
 * Returns venues suitable for families — used by TodayView "Places to Go" and
 * WeekendPlanner "Weekend Destinations" sections.
 *
 * Selection: venues with family_friendly occasion OR family-relevant venue_type.
 * Optionally filtered by indoor/outdoor and sorted by popularity or editorial.
 *
 * Query params:
 *   portal        (required) portal slug
 *   environment   indoor | outdoor | both
 *   sort          popular | editorial  (default: popular)
 *   limit         max results (default 12, max 40)
 *   offset        pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portalParam = searchParams.get("portal");
  const environment = searchParams.get("environment"); // "indoor" | "outdoor" | "both" | null
  const sort = searchParams.get("sort") ?? "popular"; // "popular" | "editorial"
  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 12, 40);
  const offset = parseIntParam(searchParams.get("offset")) ?? 0;

  if (!portalParam || !isValidString(portalParam, 1, 80)) {
    return NextResponse.json({ error: "portal param required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const portal = await getPortalBySlug(portalParam);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Extract city scope for portal isolation
    const portalFilters = portal.filters as { city?: string; cities?: string[] } | null;
    const portalCities = [
      ...(portalFilters?.cities ?? []),
      ...(portalFilters?.city ? [portalFilters.city] : []),
    ].filter(Boolean);

    // Venue types that are inherently family-relevant
    const FAMILY_VENUE_TYPES = [
      "museum", "zoo", "aquarium", "theme_park", "park", "garden",
      "nature_preserve", "playground", "farm", "recreation_center",
      "bowling", "arcade", "trampoline_park", "indoor_play", "library",
      "swimming_pool", "botanical_garden",
    ];

    // Indoor venue types (for environment filter)
    const INDOOR_TYPES = new Set([
      "museum", "bowling", "arcade", "trampoline_park", "indoor_play",
      "library", "aquarium", "ice_rink",
    ]);

    // Outdoor venue types (for environment filter)
    const OUTDOOR_TYPES = new Set([
      "park", "garden", "nature_preserve", "playground", "farm",
      "swimming_pool", "botanical_garden",
    ]);

    // Both (zoo, theme_park, rec_center can be either)
    const BOTH_TYPES = new Set([
      "zoo", "theme_park", "recreation_center",
    ]);

    // Build the base venue query
    // We pull candidates using two signals: family_friendly occasion + family venue types.
    // We do a two-pass: first fetch venue IDs with the occasion, then OR with venue_type.
    const today = getLocalDateString();

    // Pass 1: get venue IDs that have a family_friendly occasion
    const { data: occasionRows } = await supabase
      .from("place_occasions")
      .select("place_id")
      .eq("occasion", "family_friendly")
      .gte("confidence", 0.5);

    const familyOccasionIds = new Set(
      (occasionRows ?? []).map((r: { place_id: number }) => r.place_id)
    );

    // Pass 2: query venues — match either occasion (family_friendly) or family venue_type.
    // Use IN clause to scope to family venue types OR known occasion-matched IDs.
    const occasionIdList = Array.from(familyOccasionIds);
    const familyTypeList = FAMILY_VENUE_TYPES;

    // Build the query: venue_type IN (family types) OR id IN (occasion-matched ids)
    // PostgREST OR syntax: "condition1,condition2"
    let orFilter = `place_type.in.(${familyTypeList.join(",")})`;
    if (occasionIdList.length > 0) {
      orFilter += `,id.in.(${occasionIdList.slice(0, 200).join(",")})`;
    }

    let venuesQuery = supabase
      .from("places")
      .select(`
        id,
        name,
        slug,
        address,
        neighborhood,
        image_url,
        hero_image_url,
        place_type,
        indoor_outdoor,
        short_description,
        library_pass
      `)
      .eq("is_active", true)
      .not("name", "is", null)
      .not("address", "is", null)
      .not("slug", "is", null)
      .or(orFilter);

    if (portalCities.length > 0) {
      venuesQuery = venuesQuery.in("city", portalCities);
    }

    const { data: allVenueRows, error: venueError } = await venuesQuery
      .order("name", { ascending: true })
      .limit(300);

    if (venueError) {
      console.error("[family/destinations] venue query failed:", venueError.message);
      return NextResponse.json({ error: "Failed to fetch destinations" }, { status: 500 });
    }

    type VenueRow = {
      id: number;
      name: string;
      slug: string | null;
      address: string | null;
      neighborhood: string | null;
      image_url: string | null;
      hero_image_url: string | null;
      place_type: string | null;
      indoor_outdoor: string | null;
      short_description: string | null;
      library_pass: { eligible?: boolean; card_type?: string; notes?: string } | null;
    };

    const venueRows = (allVenueRows ?? []) as VenueRow[];
    // All rows from the SQL query are already family-relevant (type or occasion match)
    // Exclude venue types that are not appropriate for a family destinations section,
    // regardless of whether they matched via the family_friendly occasion tag.
    // These types may have a family_friendly occasion from inference (e.g. stadiums
    // hosting a family day), but they are not "places to take the kids" destinations.
    const EXCLUDED_VENUE_TYPES = new Set([
      "stadium", "arena", "nightclub", "bar", "sports_bar", "distillery",
      "winery", "brewery", "lounge", "casino",
      // Restaurants/cafes are destinations but not activity venues —
      // a family portal's "Places to Go" carousel should show places you DO things,
      // not places you eat. Restaurants appear naturally in venue search.
      "restaurant", "cafe", "diner", "food_truck", "soul_food",
    ]);

    const familyVenues = venueRows.filter(
      (v) => !v.place_type || !EXCLUDED_VENUE_TYPES.has(v.place_type)
    );

    // Apply environment filter
    let environmentFiltered = familyVenues;
    if (environment === "indoor") {
      environmentFiltered = familyVenues.filter((v) => {
        if (v.indoor_outdoor === "indoor") return true;
        if (v.indoor_outdoor === "both") return true;
        // Fall back to venue_type classification
        if (!v.indoor_outdoor && v.place_type) {
          if (INDOOR_TYPES.has(v.place_type)) return true;
          if (BOTH_TYPES.has(v.place_type)) return true;
        }
        return false;
      });
    } else if (environment === "outdoor") {
      environmentFiltered = familyVenues.filter((v) => {
        if (v.indoor_outdoor === "outdoor") return true;
        if (v.indoor_outdoor === "both") return true;
        if (!v.indoor_outdoor && v.place_type) {
          if (OUTDOOR_TYPES.has(v.place_type)) return true;
          if (BOTH_TYPES.has(v.place_type)) return true;
        }
        return false;
      });
    }

    const venueIds = environmentFiltered.map((v) => v.id);

    if (venueIds.length === 0) {
      return NextResponse.json(
        { destinations: [], total: 0 },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    // Fetch event counts, editorial mentions, and occasions in parallel
    const venueIdSlice = venueIds.slice(0, 200);
    const thirtyDaysOut = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })();

    const portalClient = await createPortalScopedClient(portal.id);
    let eventQuery = portalClient
      .from("events")
      .select("place_id, id")
      .in("place_id", venueIdSlice)
      .gte("start_date", today)
      .lte("start_date", thirtyDaysOut)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");

    eventQuery = applyFeedGate(eventQuery);
    eventQuery = applyPortalScopeToQuery(eventQuery, {
      portalId: portal.id,
      portalExclusive: false,
      publicOnlyWhenNoPortal: true,
    });

    const [
      { data: eventRows },
      { data: editorialRows },
      { data: occasionDetailRows },
    ] = await Promise.all([
      eventQuery.limit(2000),
      supabase
        .from("editorial_mentions")
        .select("venue_id")
        .in("place_id", venueIdSlice)
        .eq("is_active", true),
      supabase
        .from("place_occasions")
        .select("place_id, occasion, confidence")
        .in("place_id", venueIdSlice)
        .gte("confidence", 0.5)
        .order("confidence", { ascending: false }),
    ]);

    const eventCountMap = new Map<number, number>();
    for (const ev of (eventRows ?? []) as { venue_id: number; id: number }[]) {
      eventCountMap.set(ev.venue_id, (eventCountMap.get(ev.venue_id) ?? 0) + 1);
    }

    const editorialCountMap = new Map<number, number>();
    for (const row of (editorialRows ?? []) as { venue_id: number }[]) {
      editorialCountMap.set(row.venue_id, (editorialCountMap.get(row.venue_id) ?? 0) + 1);
    }

    const occasionMap = new Map<number, string[]>();
    for (const row of (occasionDetailRows ?? []) as { venue_id: number; occasion: string; confidence: number }[]) {
      const existing = occasionMap.get(row.venue_id) ?? [];
      if (!existing.includes(row.occasion)) {
        existing.push(row.occasion);
      }
      occasionMap.set(row.venue_id, existing);
    }

    // Enrich and build result objects
    const enriched = environmentFiltered.map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      address: v.address,
      neighborhood: v.neighborhood,
      image_url: v.hero_image_url ?? v.image_url,
      venue_type: v.place_type, // bridge: place_type → venue_type for API consumers
      indoor_outdoor: v.indoor_outdoor,
      description: v.short_description,
      editorial_mention_count: editorialCountMap.get(v.id) ?? 0,
      upcoming_event_count: eventCountMap.get(v.id) ?? 0,
      occasions: occasionMap.get(v.id) ?? [],
      library_pass_eligible: v.library_pass?.eligible === true,
    }));

    // Sort
    // In all sort modes, venues with images are prioritized first — ensures the
    // carousel always opens on a photo, not a map pin fallback.
    function hasImage(v: { image_url: string | null }): number {
      return v.image_url ? 1 : 0;
    }

    let sorted: typeof enriched;
    if (sort === "editorial") {
      sorted = enriched.sort((a, b) => {
        // Primary: image presence
        const imgCmp = hasImage(b) - hasImage(a);
        if (imgCmp !== 0) return imgCmp;
        // Secondary: has editorial mentions
        if (b.editorial_mention_count !== a.editorial_mention_count) {
          return b.editorial_mention_count - a.editorial_mention_count;
        }
        // Tertiary: upcoming events
        return b.upcoming_event_count - a.upcoming_event_count;
      });
    } else {
      // "popular" — primary: image, secondary: upcoming events, tertiary: editorial
      sorted = enriched.sort((a, b) => {
        const imgCmp = hasImage(b) - hasImage(a);
        if (imgCmp !== 0) return imgCmp;
        if (b.upcoming_event_count !== a.upcoming_event_count) {
          return b.upcoming_event_count - a.upcoming_event_count;
        }
        return b.editorial_mention_count - a.editorial_mention_count;
      });
    }

    const paginated = sorted.slice(offset, offset + limit);

    return NextResponse.json(
      { destinations: paginated, total: sorted.length },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("[family/destinations] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
