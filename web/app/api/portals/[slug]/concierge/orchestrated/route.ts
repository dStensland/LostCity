import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getPortalSourceAccess } from "@/lib/federation";
import { isValidUUID, parseFloatParam, parseIntParam } from "@/lib/api-utils";
import { runConciergeOrchestration } from "@/lib/agents/concierge/orchestrator";
import type {
  ConciergeDestination,
  FeedSection,
  SourceAccessDetail,
} from "@/lib/agents/concierge/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type PortalFilters = {
  geo_center?: [number, number];
  geo_radius_km?: number;
};

type PortalRow = {
  id: string;
  slug: string;
  name: string;
  filters: PortalFilters | string | null;
};

function parsePortalFilters(raw: PortalFilters | string | null | undefined): PortalFilters {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PortalFilters;
    } catch {
      return {};
    }
  }
  return raw;
}

function createRequestId(): string {
  const base = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().split("-")[0]
    : Math.random().toString(36).slice(2, 10);
  return `CA-${Date.now().toString(36).toUpperCase()}-${base.toUpperCase()}`;
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

  const supabase = await createClient();
  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name, filters")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portal = portalData as PortalRow | null;
  if (portalError || !portal || !isValidUUID(portal.id)) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const parsedFilters = parsePortalFilters(portal.filters);
  const center = parsedFilters.geo_center;
  const lat = latParam ?? center?.[0];
  const lng = lngParam ?? center?.[1];
  const radius = radiusParam ?? parsedFilters.geo_radius_km;

  const sharedParams = new URLSearchParams();
  if (lat !== null && lat !== undefined) sharedParams.set("lat", String(lat));
  if (lng !== null && lng !== undefined) sharedParams.set("lng", String(lng));
  if (radius !== null && radius !== undefined) sharedParams.set("radius_km", String(radius));

  const allParams = new URLSearchParams(sharedParams);
  allParams.set("include_upcoming_hours", String(includeUpcomingHours));
  allParams.set("limit", String(limit));

  const liveParams = new URLSearchParams(sharedParams);
  liveParams.set("active_now", "true");
  liveParams.set("limit", String(liveLimit));

  const requestId = createRequestId();
  const baseOrigin = url.origin;

  const [feedRes, allDestRes, liveDestRes, sourceAccess] = await Promise.all([
    fetch(`${baseOrigin}/api/portals/${slug}/feed`, { cache: "no-store" }),
    fetch(`${baseOrigin}/api/portals/${slug}/destinations/specials?${allParams.toString()}`, { cache: "no-store" }),
    fetch(`${baseOrigin}/api/portals/${slug}/destinations/specials?${liveParams.toString()}`, { cache: "no-store" }),
    getPortalSourceAccess(portal.id),
  ]);

  if (!feedRes.ok || !allDestRes.ok || !liveDestRes.ok) {
    return NextResponse.json(
      {
        error: "Failed to assemble concierge orchestration payload",
        statuses: {
          feed: feedRes.status,
          destinations_all: allDestRes.status,
          destinations_live: liveDestRes.status,
        },
      },
      { status: 502 }
    );
  }

  const [feedData, allDestData, liveDestData] = await Promise.all([
    feedRes.json() as Promise<{ sections?: FeedSection[] }>,
    allDestRes.json() as Promise<{ destinations?: ConciergeDestination[]; meta?: unknown }>,
    liveDestRes.json() as Promise<{ destinations?: ConciergeDestination[] }>,
  ]);

  const sections = Array.isArray(feedData.sections) ? feedData.sections : [];
  const destinations = Array.isArray(allDestData.destinations) ? allDestData.destinations : [];
  const liveDestinations = Array.isArray(liveDestData.destinations) ? liveDestData.destinations : [];
  const sourceDetails = sourceAccess.accessDetails as SourceAccessDetail[];

  const orchestration = runConciergeOrchestration({
    requestId,
    now: new Date(),
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
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

  return NextResponse.json({
    ...orchestration,
    data: {
      sections,
      destinations,
      live_destinations: liveDestinations,
      meta: allDestData.meta ?? null,
    },
  });
}

