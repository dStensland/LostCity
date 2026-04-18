import { NextRequest, NextResponse } from "next/server";
import {
  getNeighborhoodById,
  getNeighborhoodDescription,
} from "@/config/neighborhoods";
import { getNeighborhoodColor } from "@/lib/neighborhood-colors";
import {
  getNeighborhoodEventCounts,
  getNeighborhoodEvents,
  getNeighborhoodSpots,
} from "@/lib/neighborhoods/loaders";
import { resolveFeedPageRequest } from "@/app/[portal]/_surfaces/feed/resolve-feed-page-request";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";

/**
 * Neighborhood detail payload for the overlay view.
 *
 * Powers `?neighborhood=<slug>` overlay rendering on overlay-capable
 * surfaces (feed, explore). Mirrors the data shape the standalone
 * `/[portal]/neighborhoods/[slug]` page assembles, but in a single
 * client-fetchable JSON response.
 *
 * Cached 120s per (slug, portalId) tuple.
 */
export const revalidate = 120;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const neighborhood = getNeighborhoodById(slug);
  if (!neighborhood) {
    return NextResponse.json(
      { error: "Neighborhood not found" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const portalSlug = searchParams.get("portal");
  if (!portalSlug) {
    return NextResponse.json(
      { error: "portal query param is required" },
      { status: 400 },
    );
  }

  // Resolve the portal so loaders apply portal_id scope to events.
  const portalRequest = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/neighborhoods/${slug}`,
  });
  const portalId = portalRequest?.portal?.id ?? null;

  const spots = await getNeighborhoodSpots(neighborhood.name);
  const placeIds = spots.map((s) => s.id);

  const [events, counts] = await Promise.all([
    getNeighborhoodEvents(placeIds, portalId),
    getNeighborhoodEventCounts(placeIds, portalId),
  ]);

  return NextResponse.json({
    neighborhood: {
      id: neighborhood.id,
      slug: neighborhood.id,
      name: neighborhood.name,
      description: getNeighborhoodDescription(slug),
      color: getNeighborhoodColor(neighborhood.name),
      lat: neighborhood.lat,
      lng: neighborhood.lng,
      tier: neighborhood.tier,
      heroImage: neighborhood.heroImage,
    },
    spots: spots.slice(0, 10),
    events: events.slice(0, 8),
    counts: {
      todayCount: counts.todayCount,
      upcomingCount: counts.upcomingCount,
      spotCount: spots.length,
    },
  });
}
