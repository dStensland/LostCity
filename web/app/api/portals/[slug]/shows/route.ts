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

    let query = portalClient
      .from("events")
      .select(`
        id,
        title,
        start_time,
        end_time,
        price_min,
        price_max,
        image_url,
        is_free,
        venue:venues!inner(id, name, slug, neighborhood, image_url)
      `)
      .in("category_id", categories)
      .eq("start_date", today)
      .eq("is_active", true)
      .is("canonical_event_id", null)
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
    const events = rawEvents as { id: number; title: string; start_time: string | null; price_min: number | null; image_url: string | null; is_free: boolean; venue: { id: number; name: string; slug: string; neighborhood: string; image_url: string | null } }[] | null;

    if (queryError) {
      logger.error("Error fetching shows:", queryError);
      return NextResponse.json({ error: "Failed to fetch shows" }, { status: 500 });
    }

    // Group by venue
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

    for (const event of events ?? []) {
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

    return NextResponse.json(
      { venues },
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
