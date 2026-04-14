import { NextRequest, NextResponse } from "next/server";
import { createPortalScopedClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { logger } from "@/lib/logger";
import { isValidUUID } from "@/lib/api-utils";
import {
  applyManifestFederatedScopeToQuery,
  excludeSensitiveEvents,
  applyPortalCategoryFilters,
  parsePortalContentFilters,
} from "@/lib/portal-scope";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getPortalSourceAccess } from "@/lib/federation";
import { isNoiseEvent } from "@/lib/show-noise-filter";
import { applyFeedGate } from "@/lib/feed-gate";
import { filterMusicVenues } from "@/lib/music-venue-filter";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function isMissingIsShowColumnError(error: unknown): boolean {
  const text = [
    typeof error === "string" ? error : "",
    typeof error === "object" && error !== null && "message" in error ? String(error.message) : "",
    typeof error === "object" && error !== null && "details" in error ? String(error.details) : "",
    typeof error === "object" && error !== null && "hint" in error ? String(error.hint) : "",
  ]
    .join(" ")
    .toLowerCase();

  return text.includes("is_show") && (
    text.includes("does not exist")
    || text.includes("schema cache")
    || text.includes("column")
  );
}

// GET /api/portals/[slug]/shows?categories=music
// GET /api/portals/[slug]/shows?categories=theater,comedy,dance
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const categoriesParam = searchParams.get("categories") ?? "";
  const categories = categoriesParam
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const venueTypesParam = searchParams.get("venue_types") ?? null;
  const venueTypes = venueTypesParam
    ? venueTypesParam.split(",").map((t) => t.trim()).filter(Boolean)
    : null;
  const requireShowFilter = parseBooleanParam(searchParams.get("is_show"));

  const today = getLocalDateString(new Date());

  try {
    const portal = await getPortalBySlug(slug);
    if (!portal || !isValidUUID(portal.id)) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const portalContentFilters = parsePortalContentFilters(
      portal.filters as Record<string, unknown> | null,
    );
    const sourceAccess = await getPortalSourceAccess(portal.id);
    const portalClient = await createPortalScopedClient(portal.id);
    const manifest = buildPortalManifest({
      portalId: portal.id,
      slug: portal.slug,
      portalType: portal.portal_type,
      parentPortalId: portal.parent_portal_id,
      settings: portal.settings,
      filters: portal.filters as { city?: string; cities?: string[] } | null,
      sourceIds: sourceAccess.sourceIds,
    });

    // Fetch today's shows for display + this week's count for the "N more this week" note
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const buildShowsQuery = (includeIsShowFilter: boolean) => {
      let query = portalClient
        .from("events")
        .select(`
          id,
          title,
          start_date,
          start_time,
          end_time,
          price_min,
          price_max,
          image_url,
          is_free,
          tags,
          doors_time,
          genres,
          venue:places!inner(id, name, slug, neighborhood, image_url, place_type)
        `)
        .gte("start_date", today)
        .lte("start_date", weekEndStr)
        .eq("is_active", true)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (categories.length > 0) {
        query = query.in("category_id", categories);
      }

      if (venueTypes && venueTypes.length > 0) {
        query = query.in("places.place_type", venueTypes);
      }

      if (includeIsShowFilter) {
        query = query.eq("is_show", true);
      }

      query = applyFeedGate(query);
      query = applyManifestFederatedScopeToQuery(query, manifest, {
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess.sourceIds,
        sourceColumn: "source_id",
      });
      query = excludeSensitiveEvents(query);
      // Skip portal category filters — we already filter by the user's requested categories
      // applyPortalCategoryFilters would add a second .in("category_id") that conflicts
      // query = applyPortalCategoryFilters(query, portalContentFilters);
      return query;
    };

    let { data: rawEvents, error: queryError } = await buildShowsQuery(requireShowFilter);
    if (queryError && requireShowFilter && isMissingIsShowColumnError(queryError)) {
      logger.warn("Shows API falling back without is_show filter because the column is missing");
      ({ data: rawEvents, error: queryError } = await buildShowsQuery(false));
    }
    const events = rawEvents as { id: number; title: string; start_date: string; start_time: string | null; price_min: number | null; image_url: string | null; is_free: boolean; tags: string[] | null; doors_time: string | null; genres: string[] | null; venue: { id: number; name: string; slug: string; neighborhood: string; image_url: string | null; place_type: string | null } }[] | null;

    if (queryError) {
      logger.error("Error fetching shows:", queryError);
      return NextResponse.json({ error: "Failed to fetch shows" }, { status: 500 });
    }

    // Post-query: filter to genuine live performances
    const filteredEvents = (events ?? []).filter(event =>
      !isNoiseEvent(event.title, event.venue?.place_type ?? null)
    );

    // Split into today vs rest of week for counting
    const todayEvents = filteredEvents.filter(e => e.start_date === today);

    // Group ALL week's events by venue (not just today)
    // This ensures venues with shows later this week still appear
    type VenueRow = {
      id: number;
      name: string;
      slug: string;
      neighborhood: string | null;
      image_url: string | null;
      place_type?: string | null;
    };

    type ShowRow = {
      id: number;
      title: string;
      start_date: string;
      start_time: string | null;
      price_min: number | null;
      image_url: string | null;
      is_free: boolean;
      tags: string[];
      doors_time: string | null;
      genres: string[];
    };

    const venueMap = new Map<number, { venue: VenueRow; shows: ShowRow[] }>();

    for (const event of filteredEvents) {
      const venue = event.venue as VenueRow | null;
      if (!venue?.id) continue;

      if (!venueMap.has(venue.id)) {
        venueMap.set(venue.id, { venue, shows: [] });
      }

      venueMap.get(venue.id)!.shows.push({
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        start_time: event.start_time,
        price_min: event.price_min,
        image_url: event.image_url,
        is_free: event.is_free,
        tags: event.tags ?? [],
        doors_time: event.doors_time ?? null,
        genres: event.genres ?? [],
      });
    }

    // Apply music tab venue quality filter when appropriate
    const isMusicTab = categories.length === 1 && categories[0] === "music";
    const qualifiedGroups = isMusicTab
      ? filterMusicVenues(Array.from(venueMap.values()))
      : Array.from(venueMap.values());

    // Sort venues: those with today's shows first, then by total show count
    const venues = qualifiedGroups.sort((a, b) => {
      const aHasToday = a.shows.some(s => s.start_date === today) ? 1 : 0;
      const bHasToday = b.shows.some(s => s.start_date === today) ? 1 : 0;
      if (bHasToday !== aHasToday) return bHasToday - aHasToday;
      return b.shows.length - a.shows.length;
    });

    // Count unique shows this week using only qualified venues
    const qualifiedVenueIds = new Set(qualifiedGroups.map(g => g.venue.id));
    const qualifiedEvents = filteredEvents.filter(e => qualifiedVenueIds.has(e.venue?.id));
    const weekTitles = new Set(qualifiedEvents.map((e: { title: string }) => e.title));
    const thisWeekCount = weekTitles.size;
    const qualifiedTodayEvents = qualifiedEvents.filter(e => e.start_date === today);
    const todayCount = new Set(qualifiedTodayEvents.map(e => e.title)).size;

    return NextResponse.json(
      {
        venues,
        today_count: todayCount,
        this_week_count: thisWeekCount,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    logger.error("Error in shows GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
