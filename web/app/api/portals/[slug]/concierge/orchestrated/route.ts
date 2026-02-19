import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getPortalBySlug } from "@/lib/portal";
import { getPortalSourceAccess } from "@/lib/federation";
import { parseFloatParam, parseIntParam } from "@/lib/api-utils";
import { runConciergeOrchestration } from "@/lib/agents/concierge/orchestrator";
import { getForthFeed } from "@/lib/forth-data";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { logger } from "@/lib/logger";
import type { Portal } from "@/lib/portal-context";
import type {
  ConciergeDestination,
  FeedSection,
  SourceAccessDetail,
} from "@/lib/agents/concierge/types";

export const dynamic = "force-dynamic";

const ORCHESTRATED_CACHE_NAMESPACE = "api:concierge-orch-data";
const ORCHESTRATED_CACHE_TTL_MS = 30 * 1000;
const ORCHESTRATED_CACHE_MAX_ENTRIES = 120;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function createRequestId(): string {
  const base =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);
  return `CA-${Date.now().toString(36).toUpperCase()}-${base.toUpperCase()}`;
}

function buildStableSearchParamsKey(searchParams: URLSearchParams): string {
  return Array.from(searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function applyGeoOverrides(
  portal: Portal,
  latParam: number | undefined,
  lngParam: number | undefined,
  radiusParam: number | undefined,
): Portal {
  const filters = { ...(portal.filters || {}) };
  const existingCenter = Array.isArray(filters.geo_center) ? filters.geo_center : undefined;

  const centerLat = latParam ?? existingCenter?.[0];
  const centerLng = lngParam ?? existingCenter?.[1];
  if (centerLat !== undefined && centerLng !== undefined) {
    filters.geo_center = [centerLat, centerLng];
  }

  if (radiusParam !== undefined) {
    filters.geo_radius_km = radiusParam;
  }

  return {
    ...portal,
    filters,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const includeUpcomingHours = parseFloatParam(searchParams.get("include_upcoming_hours"), 5) ?? 5;
  const limit = Math.min(parseIntParam(searchParams.get("limit"), 120) ?? 120, 200);
  const liveLimit = Math.min(parseIntParam(searchParams.get("live_limit"), 36) ?? 36, 100);
  const latParam = parseFloatParam(searchParams.get("lat"));
  const lngParam = parseFloatParam(searchParams.get("lng"));
  const radiusParam = parseFloatParam(searchParams.get("radius_km"));

  const portal = await getPortalBySlug(slug);
  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const effectivePortal = applyGeoOverrides(
    portal,
    latParam ?? undefined,
    lngParam ?? undefined,
    radiusParam ?? undefined,
  );

  const cacheKey = `${effectivePortal.id}|${buildStableSearchParamsKey(searchParams)}`;

  try {
    const payload = await getOrSetSharedCacheJson<Record<string, unknown>>(
      ORCHESTRATED_CACHE_NAMESPACE,
      cacheKey,
      ORCHESTRATED_CACHE_TTL_MS,
      async () => {
        const requestId = createRequestId();
        const sourceAccess = await getPortalSourceAccess(effectivePortal.id);
        const feedData = await getForthFeed(effectivePortal, {
          destinationLimit: limit,
          liveDestinationLimit: liveLimit,
          includeUpcomingHours,
          sourceAccess,
        });

        const sections = (Array.isArray(feedData.sections)
          ? feedData.sections
          : []) as FeedSection[];
        const destinations = (Array.isArray(feedData.destinations)
          ? feedData.destinations
          : []) as ConciergeDestination[];
        const liveDestinations = (Array.isArray(feedData.liveDestinations)
          ? feedData.liveDestinations
          : []) as ConciergeDestination[];
        const sourceDetails = sourceAccess.accessDetails as SourceAccessDetail[];

        const orchestration = runConciergeOrchestration({
          requestId,
          now: new Date(),
          portal: {
            id: effectivePortal.id,
            slug: effectivePortal.slug,
            name: effectivePortal.name,
          },
          session: {
            persona: searchParams.get("guest_persona"),
            intent: searchParams.get("concierge_intent"),
            view: searchParams.get("concierge_view"),
            discoveryFocus: searchParams.get("concierge_focus"),
            foodFocus: searchParams.get("concierge_food_focus"),
            mode: searchParams.get("concierge_mode"),
          },
          sourceAccess: sourceDetails,
          sections,
          destinations,
          liveDestinations,
        });

        return {
          ...orchestration,
          data: {
            sections,
            destinations,
            live_destinations: liveDestinations,
            meta: feedData.specialsMeta ?? null,
          },
        };
      },
      { maxEntries: ORCHESTRATED_CACHE_MAX_ENTRIES },
    );

    return NextResponse.json(payload);
  } catch (error) {
    logger.error("Concierge orchestrated API error:", error);
    return NextResponse.json(
      { error: "Failed to assemble concierge orchestration payload" },
      { status: 500 },
    );
  }
}
