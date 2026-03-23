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
import { applyFeedGate } from "@/lib/feed-gate";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

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
  const categoriesParam = searchParams.get("categories") ?? "music";
  const categories = categoriesParam
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

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

    // Venue types that host live performances (music, comedy, theater)
    const PERFORMANCE_VENUE_TYPES = [
      "music_venue", "concert_hall", "bar_live_music", "theater",
      "comedy_club", "performing_arts_center", "arena", "amphitheater",
      "nightclub", "bar", "lounge", "restaurant_live_music",
      "art_gallery", "community_arts_center", "event_space",
    ];

    // Title patterns that indicate non-performance events despite music category
    const NOISE_TITLE_PATTERNS = [
      "bingo", "trivia", "game night", "language learning",
      "book club", "pop up", "pop-up", "popup",
      "tax aide", "tax help", "story time",
    ];

    // Fetch today's shows for display + this week's count for the "N more this week" note
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

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
        venue:venues!inner(id, name, slug, neighborhood, image_url, venue_type)
      `)
      .in("category_id", categories)
      .gte("start_date", today)
      .lte("start_date", weekEndStr)
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true });

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

    const { data: rawEvents, error: queryError } = await query;
    const events = rawEvents as { id: number; title: string; start_date: string; start_time: string | null; price_min: number | null; image_url: string | null; is_free: boolean; venue: { id: number; name: string; slug: string; neighborhood: string; image_url: string | null; venue_type: string | null } }[] | null;

    if (queryError) {
      logger.error("Error fetching shows:", queryError);
      return NextResponse.json({ error: "Failed to fetch shows" }, { status: 500 });
    }

    // Post-query: filter to genuine live performances
    // Two layers: (1) exclude by venue_type, (2) exclude by title pattern
    const EXCLUDED_VENUE_TYPES = new Set(["library", "recreation", "school", "government", "religious"]);

    const filteredEvents = (events ?? []).filter(event => {
      const venueType = event.venue?.venue_type ?? "";
      const title = event.title.toLowerCase();

      // Layer 1: Exclude events at non-performance venue types
      if (EXCLUDED_VENUE_TYPES.has(venueType)) return false;

      // Layer 2: Exclude events whose titles indicate non-performance activity
      // (catches noise at bars/generic venues where venue_type alone isn't enough)
      if (NOISE_TITLE_PATTERNS.some(p => title.includes(p))) return false;

      return true;
    });

    // Split into today vs rest of week
    const todayEvents = filteredEvents.filter(e => e.start_date === today);
    const weekEvents = filteredEvents;

    // Group today's events by venue
    type VenueRow = {
      id: number;
      name: string;
      slug: string;
      neighborhood: string | null;
      image_url: string | null;
    };

    type ShowRow = {
      id: number;
      title: string;
      start_time: string | null;
      price_min: number | null;
      image_url: string | null;
      is_free: boolean;
    };

    const venueMap = new Map<number, { venue: VenueRow; shows: ShowRow[] }>();

    for (const event of todayEvents) {
      const venue = event.venue as VenueRow | null;
      if (!venue?.id) continue;

      if (!venueMap.has(venue.id)) {
        venueMap.set(venue.id, { venue, shows: [] });
      }

      venueMap.get(venue.id)!.shows.push({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        price_min: event.price_min,
        image_url: event.image_url,
        is_free: event.is_free,
      });
    }

    // Sort venues by show count (most shows first)
    const venues = Array.from(venueMap.values()).sort(
      (a, b) => b.shows.length - a.shows.length,
    );

    // Count unique shows this week (dedup by title to avoid recurrence inflation)
    const weekTitles = new Set(weekEvents.map(e => e.title));
    const thisWeekCount = weekTitles.size;
    const todayCount = new Set(todayEvents.map(e => e.title)).size;

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
