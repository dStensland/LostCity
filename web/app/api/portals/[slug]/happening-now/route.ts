import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/api-utils";
import { DESTINATION_CATEGORIES } from "@/lib/spots";
import { logger } from "@/lib/logger";
import {
  applyManifestFederatedScopeToQuery,
  excludeSensitiveEvents,
  filterByPortalCity,
  parsePortalContentFilters,
  applyPortalCategoryFilters,
  filterByPortalContentScope,
} from "@/lib/portal-scope";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const HAPPENING_NOW_CACHE_TTL_MS = 120 * 1000;
const HAPPENING_NOW_CACHE_MAX_ENTRIES = 120;
const HAPPENING_NOW_CACHE_NAMESPACE = "api:happening-now";

async function getCachedHappeningNowPayload(
  key: string,
): Promise<Record<string, unknown> | null> {
  return getSharedCacheJson<Record<string, unknown>>(
    HAPPENING_NOW_CACHE_NAMESPACE,
    key
  );
}

async function setCachedHappeningNowPayload(
  key: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await setSharedCacheJson(
    HAPPENING_NOW_CACHE_NAMESPACE,
    key,
    payload,
    HAPPENING_NOW_CACHE_TTL_MS,
    { maxEntries: HAPPENING_NOW_CACHE_MAX_ENTRIES }
  );
}

// GET /api/portals/[slug]/happening-now - Get events happening right now
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  const countOnly = searchParams.get("countOnly") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20") || 20, 100);
  const now = new Date();
  const today = getLocalDateString(now);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}:00`;
  const cacheKey = `${slug}|${countOnly ? "count" : "events"}|${limit}|${today}|h${currentHour}`;
  const cachedPayload = await getCachedHappeningNowPayload(cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240",
      },
    });
  }

  const supabase = await createClient();

  try {
    // Get portal
    const portal = await getPortalBySlug(slug);
    if (!portal || !isValidUUID(portal.id)) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }
    const portalCity =
      portal.portal_type === "business"
        ? undefined
        : (
            portal.filters &&
            typeof portal.filters === "object" &&
            !Array.isArray(portal.filters) &&
            "city" in portal.filters &&
            typeof (portal.filters as { city?: unknown }).city === "string"
          )
        ? (portal.filters as { city: string }).city
        : undefined;
    const portalContentFilters = parsePortalContentFilters(
      portal.filters as Record<string, unknown> | null
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

    // Build query for events happening now
    // An event is "happening now" if:
    // 1. It's today
    // 2. It has started (start_time <= now)
    // 3. It hasn't ended (end_time > now, or no end_time and within 3 hours of start)

    let query = portalClient
      .from("events")
      .select(countOnly ? "*" : `
        id,
        title,
        start_date,
        start_time,
        end_time,
        is_all_day,
        category:category_id,
        tags,
        image_url,
        venue:places(id, name, slug, neighborhood, city, location_designator, lat, lng, image_url)
      `, { count: countOnly ? "exact" : undefined, head: countOnly })
      .eq("start_date", today)
      .eq("is_all_day", false)
      .not("start_time", "is", null)
      .lte("start_time", currentTimeStr);

    query = applyFeedGate(query);

    query = applyManifestFederatedScopeToQuery(query, manifest, {
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });

    query = excludeSensitiveEvents(query);

    // Apply portal category filters (include/exclude)
    query = applyPortalCategoryFilters(query, portalContentFilters);

    // Order by start time, then data_quality as tiebreaker
    if (!countOnly) {
      query = query
        .order("start_time", { ascending: true })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .limit(limit);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error("Error fetching happening now events:", error);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    if (countOnly) {
      // Count currently-open destination spots using server-side RPC (avoids fetching 1500+ rows)
      const placeTypes = Object.keys(DESTINATION_CATEGORIES).flatMap(
        (key) => DESTINATION_CATEGORIES[key as keyof typeof DESTINATION_CATEGORIES]
      );

      const { data: openSpotData } = await supabase.rpc("count_open_spots", {
        p_venue_types: placeTypes,
        p_city: portalCity ?? null,
      } as never) as unknown as { data: number | null };

      const openSpotCount = openSpotData ?? 0;

      const payload = {
        count: (count || 0) + openSpotCount,
        eventCount: count || 0,
        spotCount: openSpotCount,
      };
      await setCachedHappeningNowPayload(cacheKey, payload);
      return NextResponse.json(payload);
    }

    // Filter events that haven't ended yet
    interface EventRow {
      start_time: string | null;
      end_time: string | null;
      category?: string | null;
      tags?: string[] | null;
      price?: number | null;
      venue?: {
        id?: number | null;
        city?: string | null;
        neighborhood?: string | null;
        lat?: number | null;
        lng?: number | null;
      } | null;
      [key: string]: unknown;
    }
    const scopedByCity = filterByPortalCity(
      (data || []) as EventRow[],
      portalCity,
      { allowMissingCity: true }
    );
    const scopedByContent = filterByPortalContentScope(scopedByCity, portalContentFilters);
    const liveEvents = scopedByContent.filter((event: EventRow) => {
      if (!event.start_time) return false;

      // Parse start time
      const [startHour, startMinute] = event.start_time.split(":").map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const currentMinutes = currentHour * 60 + currentMinute;

      // If event has an end time, check if we're before it
      if (event.end_time) {
        const [endHour, endMinute] = event.end_time.split(":").map(Number);
        const endMinutes = endHour * 60 + endMinute;
        return currentMinutes < endMinutes;
      }

      // No end time - assume event lasts 3 hours
      const assumedEndMinutes = startMinutes + 180;
      return currentMinutes < assumedEndMinutes;
    });

    // Filter regular showtimes from happening now
    const filteredEvents = liveEvents.filter(
      (event: EventRow) => !event.tags?.includes("showtime")
    );

    const payload = {
      events: filteredEvents,
      count: filteredEvents.length,
    };
    await setCachedHappeningNowPayload(cacheKey, payload);
    return NextResponse.json(
      payload,
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240",
        },
      }
    );
  } catch (error) {
    logger.error("Error in happening-now GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
