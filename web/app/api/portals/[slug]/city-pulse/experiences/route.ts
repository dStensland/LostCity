/**
 * GET /api/portals/[slug]/city-pulse/experiences
 *
 * Lightweight endpoint for experience venues (parks, museums, trails, etc.)
 * with upcoming event counts. Extracted from the monolithic city-pulse
 * endpoint to enable progressive loading — this data is below-the-fold
 * and doesn't need to block the initial feed render.
 *
 * Returns the same CityPulseSection shape that ExperiencesSection expects.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { getLocalDateString } from "@/lib/formats";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { THINGS_TO_DO_TILES, type Spot } from "@/lib/spots-constants";
import { applyFeedGate } from "@/lib/feed-gate";
import { buildExperiencesSection } from "@/lib/city-pulse/section-builders";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Chain / franchise venues to exclude from Things to Do (case-insensitive prefix match) */
const CHAIN_VENUE_PREFIXES = [
  "amc ",
  "regal ",
  "cinemark ",
  "marcus theatres",
  "marcus cinema",
  "century theatres",
  "megaplex",
  "planet fitness",
  "la fitness",
  "orangetheory",
  "goldfish swim",
  "lifetime fitness",
  "topgolf",
];

const CACHE_NAMESPACE = "api:city-pulse-experiences";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

const VENUE_SELECT = `
  id, name, slug, address, neighborhood, city, place_type,
  venue_types, lat, lng, image_url, short_description,
  vibes, genres, price_level, hours_display,
  hours, featured, is_active,
  location_designator
`;

type Props = { params: Promise<{ slug: string }> };

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const canonicalSlug = resolvePortalSlugAlias(normalizePortalSlug(slug));

  const supabase = await createClient();

  // Cache check
  const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const cacheKey = `${canonicalSlug}|${cacheBucket}`;
  const cached = await getSharedCacheJson<unknown>(CACHE_NAMESPACE, cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  // Portal lookup
  const portalResult = await supabase
    .from("portals")
    .select("id, slug, name, portal_type, parent_portal_id, settings, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!portalResult.data) {
    return NextResponse.json({ section: null }, { status: 404 });
  }

  const portalData = portalResult.data as {
    id: string;
    slug: string;
    name: string;
    portal_type: string;
    parent_portal_id?: string | null;
    settings: Record<string, unknown> | null;
    filters?: Record<string, unknown> | string | null;
  };

  // Parse filters
  const portalFilters = parsePortalFilters(portalData.filters);
  const portalCity = portalFilters.city;
  const geoCenter = portalFilters.geo_center;

  // Portal scoping
  const portalClient = await createPortalScopedClient(portalData.id);
  const federationAccess = await getPortalSourceAccess(portalData.id);
  const hasSubscribedSources = federationAccess.sourceIds.length > 0;

  const manifest = buildPortalManifest({
    portalId: portalData.id,
    slug: canonicalSlug,
    portalType: portalData.portal_type,
    parentPortalId: portalData.parent_portal_id,
    settings: portalData.settings,
    filters: portalFilters as { city?: string; cities?: string[] },
    sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
  });

  const applyPortalScope = <T>(query: T): T => {
    return applyManifestFederatedScopeToQuery(query, manifest, {
      sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
      publicOnlyWhenNoPortal: true,
    });
  };

  // Build experience venues query
  const allTypes = THINGS_TO_DO_TILES.flatMap((t) => [...t.venueTypes]);
  allTypes.push("outdoor_venue", "entertainment");

  let venueQuery = supabase
    .from("places")
    .select(VENUE_SELECT)
    .in("place_type", allTypes)
    .eq("is_active", true)
    .neq("location_designator", "recovery_meeting");

  if (geoCenter) {
    const radiusKm = (portalFilters.geo_radius_km ?? 25) * 1.6;
    const degOffset = radiusKm / 111;
    venueQuery = venueQuery
      .gte("lat", geoCenter[0] - degOffset)
      .lte("lat", geoCenter[0] + degOffset)
      .gte("lng", geoCenter[1] - degOffset)
      .lte("lng", geoCenter[1] + degOffset);
  } else if (portalCity) {
    venueQuery = venueQuery.ilike("city", `%${portalCity}%`);
  }

  venueQuery = venueQuery.order("name").limit(300);

  const { data: venuesRaw } = await venueQuery;
  const venues = (venuesRaw ?? []).filter((v) => {
    const nameLower = ((v as { name?: string }).name ?? "").toLowerCase();
    return !CHAIN_VENUE_PREFIXES.some((prefix) => nameLower.startsWith(prefix));
  }) as Spot[];

  if (venues.length === 0) {
    const emptyResult = { section: null };
    await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, emptyResult, CACHE_TTL_MS);
    return NextResponse.json(emptyResult, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  // Batch event count query
  const today = getLocalDateString(new Date());
  const eventCountMap = new Map<number, number>();
  const venueIds = venues.map((v) => v.id);
  const batchSize = 200;

  for (let i = 0; i < venueIds.length; i += batchSize) {
    const batch = venueIds.slice(i, i + batchSize);
    let evQ = portalClient
      .from("events")
      .select("venue_id")
      .in("place_id", batch)
      .gte("start_date", today)
      .is("canonical_event_id", null);
    evQ = applyPortalScope(evQ);
    evQ = applyFeedGate(evQ);
    const { data: evRows } = await evQ.limit(2000);
    if (evRows) {
      for (const row of evRows as { venue_id: number }[]) {
        eventCountMap.set(
          row.venue_id,
          (eventCountMap.get(row.venue_id) ?? 0) + 1,
        );
      }
    }
  }

  // Build section using the shared builder
  const section = buildExperiencesSection(venues, eventCountMap);

  const result = { section };
  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, result, CACHE_TTL_MS);

  return NextResponse.json(result, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePortalFilters(
  raw: Record<string, unknown> | string | null | undefined,
): { city?: string; cities?: string[]; geo_center?: [number, number]; geo_radius_km?: number } {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw as { city?: string; cities?: string[]; geo_center?: [number, number]; geo_radius_km?: number };
}
