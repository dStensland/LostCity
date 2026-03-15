import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { buildStableSearchCacheKey } from "@/lib/search-cache-key";
import { createServerTimingRecorder } from "@/lib/server-timing";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { createClient } from "@/lib/supabase/server";
import type { FindType as SearchFindType } from "@/lib/search-context";
import {
  getCachedPortalQueryContext,
  resolvePortalQueryContext,
  getVerticalFromRequest,
} from "@/lib/portal-query-context";
import { buildInstantSearchPayload, type InstantSearchEntityType } from "@/lib/instant-search-service";
import type { UnifiedSearchResponse } from "@/lib/unified-search";

const PREVIEW_CACHE_TTL_MS = 30 * 1000;
const PREVIEW_CACHE_MAX_ENTRIES = 200;
const PREVIEW_CACHE_NAMESPACE = "api:search-preview";
const PREVIEW_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";
const PREVIEW_IN_FLIGHT_LOADS = new Map<
  string,
  Promise<{
    payload: UnifiedSearchResponse;
    serverTiming: string;
    status?: number;
  }>
>();

function safeParseInt(
  value: string | null,
  defaultValue: number,
  min = 1,
  max = 20,
): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function normalizeFindType(value: string | null): SearchFindType {
  if (value === "events" || value === "classes" || value === "destinations") {
    return value;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const timing = createServerTimingRecorder();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (query.length < 2) {
      return NextResponse.json(
        { results: [], facets: [], total: 0, error: "Query must be at least 2 characters" },
        { status: 400 },
      );
    }

    const limit = safeParseInt(searchParams.get("limit"), 8, 1, 12);
    const viewMode = (searchParams.get("viewMode") as "feed" | "find" | "community") || "feed";
    const findType = normalizeFindType(searchParams.get("findType"));
    const typesParam = searchParams.get("types");
    const validTypes = ["event", "venue", "organizer"] as const;
    const requestedTypes = typesParam
      ? (typesParam
          .split(",")
          .filter((value) =>
            validTypes.includes(value as (typeof validTypes)[number]),
          ) as InstantSearchEntityType[])
      : (["event", "venue"] as InstantSearchEntityType[]);

    const cacheKey = buildStableSearchCacheKey(searchParams);
    const cachedPayload = await timing.measure("cache_lookup", () =>
      getSharedCacheJson<UnifiedSearchResponse>(PREVIEW_CACHE_NAMESPACE, cacheKey),
    );
    if (cachedPayload) {
      timing.addMetric("cache_hit", 0, "shared");
      return NextResponse.json(cachedPayload, {
        headers: {
          "Cache-Control": PREVIEW_CACHE_CONTROL,
          "Server-Timing": timing.toHeader(),
        },
      });
    }

    const existingLoad = PREVIEW_IN_FLIGHT_LOADS.get(cacheKey);
    if (existingLoad) {
      const result = await existingLoad;
      timing.addMetric("coalesced", 0, "inflight");
      return NextResponse.json(result.payload, {
        status: result.status,
        headers: {
          "Cache-Control": PREVIEW_CACHE_CONTROL,
          "Server-Timing": `${result.serverTiming}, ${timing.toHeader()}`,
        },
      });
    }

    const previewLoadPromise = (async (): Promise<{
      payload: UnifiedSearchResponse;
      serverTiming: string;
      status?: number;
    }> => {
      let supabaseClientPromise: ReturnType<typeof createClient> | null = null;
      const getSupabase = async () => {
        if (!supabaseClientPromise) {
          supabaseClientPromise = createClient();
        }
        return supabaseClientPromise;
      };
      const portalContext = await timing.measure("bootstrap", async () => {
        const verticalOpts = getVerticalFromRequest(request);
        const cachedContext = await getCachedPortalQueryContext(searchParams, verticalOpts);
        if (cachedContext) {
          timing.addMetric("portal_context_cache_hit", 0, "shared");
          return cachedContext;
        }
        return resolvePortalQueryContext(await getSupabase(), searchParams, verticalOpts);
      });

      if (portalContext.hasPortalParamMismatch) {
        return {
          payload: {
            results: [],
            facets: [],
            total: 0,
            error: "portal and portal_id parameters must reference the same portal",
          } as UnifiedSearchResponse,
          serverTiming: timing.toHeader(),
          status: 400,
        };
      }

      const instantPayload = await buildInstantSearchPayload({
        query,
        limit,
        requestedTypes: requestedTypes as InstantSearchEntityType[],
        portalId: portalContext.portalId,
        portalSlug: portalContext.portalSlug || "atlanta",
        portalCity: portalContext.filters.city || undefined,
        viewMode,
        findType,
        timing,
      });

      const payload: UnifiedSearchResponse = {
        results: instantPayload.suggestions,
        facets: instantPayload.facets as UnifiedSearchResponse["facets"],
        total:
          instantPayload.facets.length > 0
            ? instantPayload.facets.reduce((sum, facet) => sum + facet.count, 0)
            : instantPayload.suggestions.length,
      };

      await setSharedCacheJson(
        PREVIEW_CACHE_NAMESPACE,
        cacheKey,
        payload,
        PREVIEW_CACHE_TTL_MS,
        { maxEntries: PREVIEW_CACHE_MAX_ENTRIES },
      );

      return {
        payload,
        serverTiming: timing.toHeader(),
      };
    })();

    PREVIEW_IN_FLIGHT_LOADS.set(cacheKey, previewLoadPromise);
    let result: {
      payload: UnifiedSearchResponse;
      serverTiming: string;
      status?: number;
    };
    try {
      result = await previewLoadPromise;
    } finally {
      const currentLoad = PREVIEW_IN_FLIGHT_LOADS.get(cacheKey);
      if (currentLoad === previewLoadPromise) {
        PREVIEW_IN_FLIGHT_LOADS.delete(cacheKey);
      }
    }

    return NextResponse.json(result.payload, {
      status: result.status,
      headers: {
        "Cache-Control": PREVIEW_CACHE_CONTROL,
        "Server-Timing": result.serverTiming,
      },
    });
  } catch (error) {
    console.error("Search preview API error:", error);
    return NextResponse.json(
      { results: [], facets: [], total: 0, error: "Search failed" },
      { status: 500 },
    );
  }
}
