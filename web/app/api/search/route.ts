import { NextRequest, NextResponse } from "next/server";
import { unifiedSearch, type SearchOptions } from "@/lib/unified-search";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  getCachedPortalQueryContext,
  resolvePortalQueryContext,
  getVerticalFromRequest,
} from "@/lib/portal-query-context";
import { logger } from "@/lib/logger";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { buildStableSearchCacheKey } from "@/lib/search-cache-key";
import { createServerTimingRecorder } from "@/lib/server-timing";

type SearchRoutePayload =
  | {
      results: [];
      facets: [];
      total: 0;
      error: string;
    }
  | Awaited<ReturnType<typeof unifiedSearch>>;

// Helper to safely parse integers with validation
function safeParseInt(
  value: string | null,
  defaultValue: number,
  min = 1,
  max = 1000
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

const SEARCH_CACHE_TTL_MS = 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 200;
const SEARCH_CACHE_NAMESPACE = "api:search";
const SEARCH_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";
const SEARCH_IN_FLIGHT_LOADS = new Map<
  string,
  Promise<{
    payload: SearchRoutePayload;
    serverTiming: string;
    status?: number;
  }>
>();

/**
 * Unified search API endpoint.
 *
 * GET /api/search
 *
 * Query parameters:
 * - q: Search query (required, min 2 characters)
 * - types: Comma-separated list of entity types to search (event,venue,organizer)
 * - limit: Maximum number of results (default: 20, max: 50)
 * - offset: Result offset for pagination (default: 0)
 * - categories: Comma-separated list of category filters
 * - subcategories: Comma-separated list of subcategory filters (e.g., "nightlife.trivia")
 * - tags: Comma-separated list of tag filters (e.g., "outdoor,21+")
 * - neighborhoods: Comma-separated list of neighborhood filters
 * - date: Date filter (today, tomorrow, weekend, week)
 * - free: If "true", only return free events
 * - portal: Portal slug for scoped search (canonical)
 * - portal_id: Portal UUID for scoped search
 * - city: Optional explicit city override for venue search
 *
 * Response:
 * {
 *   results: SearchResult[],
 *   facets: { type: string, count: number }[],
 *   total: number,
 *   didYouMean?: string[]
 * }
 */
export async function GET(request: NextRequest) {
  // Rate limit: read endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const timing = createServerTimingRecorder();
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q") || "";

    // Validate query
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          results: [],
          facets: [],
          total: 0,
          error: "Query must be at least 2 characters",
        },
        { status: 400 }
      );
    }

    // Parse types
    const typesParam = searchParams.get("types");
    const validTypes = ["event", "venue", "organizer", "series", "list"] as const;
    const types = typesParam
      ? (typesParam.split(",").filter((t) =>
          validTypes.includes(t as (typeof validTypes)[number])
        ) as ("event" | "venue" | "organizer" | "series" | "list")[])
      : undefined;

    // Parse other parameters
    const limit = safeParseInt(searchParams.get("limit"), 20, 1, 50);
    const offset = safeParseInt(searchParams.get("offset"), 0, 0, 1000);

    const categoriesParam = searchParams.get("categories");
    const categories = categoriesParam
      ? categoriesParam.split(",").filter(Boolean)
      : undefined;

    const subcategoriesParam = searchParams.get("subcategories");
    const subcategories = subcategoriesParam
      ? subcategoriesParam.split(",").filter(Boolean)
      : undefined;

    const genresParam = searchParams.get("genres");
    const genres = genresParam
      ? genresParam.split(",").filter(Boolean)
      : undefined;

    const tagsParam = searchParams.get("tags");
    const tags = tagsParam
      ? tagsParam.split(",").filter(Boolean)
      : undefined;

    const neighborhoodsParam = searchParams.get("neighborhoods");
    const neighborhoods = neighborhoodsParam
      ? neighborhoodsParam.split(",").filter(Boolean)
      : undefined;

    const dateParam = searchParams.get("date");
    const dateFilter =
      dateParam &&
      ["today", "tonight", "tomorrow", "weekend", "week"].includes(dateParam)
        ? (dateParam as "today" | "tonight" | "tomorrow" | "weekend" | "week")
        : undefined;

    const isFree = searchParams.get("free") === "true" ? true : undefined;
    const includeFacets = searchParams.get("include_facets") !== "false";
    const includeDidYouMean =
      searchParams.get("include_did_you_mean") !== "false";
    const includeEventPopularity =
      searchParams.get("include_event_popularity") !== "false";
    const cacheKey = buildStableSearchCacheKey(searchParams);

    const cachedPayload = await timing.measure("cache_lookup", () =>
      getSharedCacheJson<Record<string, unknown>>(SEARCH_CACHE_NAMESPACE, cacheKey)
    );
    if (cachedPayload) {
      timing.addMetric("cache_hit", 0, "shared");
      return NextResponse.json(cachedPayload, {
        headers: {
          "Cache-Control": SEARCH_CACHE_CONTROL,
          "Server-Timing": timing.toHeader(),
        },
      });
    }

    const existingLoad = SEARCH_IN_FLIGHT_LOADS.get(cacheKey);
    if (existingLoad) {
      const result = await existingLoad;
      timing.addMetric("coalesced", 0, "inflight");
      return NextResponse.json(result.payload, {
        status: result.status,
        headers: {
          "Cache-Control": SEARCH_CACHE_CONTROL,
          "Server-Timing": `${result.serverTiming}, ${timing.toHeader()}`,
        },
      });
    }

    const searchLoadPromise: Promise<{
      payload: SearchRoutePayload;
      serverTiming: string;
      status?: number;
    }> = (async () => {
      const portalContext = await timing.measure("bootstrap", async () => {
        const verticalOpts = getVerticalFromRequest(request);
        const cachedContext = await getCachedPortalQueryContext(searchParams, verticalOpts);
        if (cachedContext) {
          timing.addMetric("portal_context_cache_hit", 0, "shared");
          return cachedContext;
        }
        return resolvePortalQueryContext(await createClient(), searchParams, verticalOpts);
      });
      if (portalContext.hasPortalParamMismatch) {
        return {
          payload: {
            results: [],
            facets: [],
            total: 0,
            error: "portal and portal_id parameters must reference the same portal",
          },
          serverTiming: timing.toHeader(),
          status: 400,
        };
      }
      const portalId = portalContext.portalId || undefined;
      const city = searchParams.get("city") || portalContext.filters.city || undefined;

      const options: SearchOptions = {
        query,
        types,
        limit,
        offset,
        categories,
        subcategories,
        genres,
        tags,
        neighborhoods,
        dateFilter,
        isFree,
        portalId,
        city,
        includeFacets,
        includeDidYouMean,
        includeEventPopularitySignals: includeEventPopularity,
        timingRecorder: timing,
      };

      const payload = await timing.measure("unified_search", () =>
        unifiedSearch(options)
      );
      await setSharedCacheJson(
        SEARCH_CACHE_NAMESPACE,
        cacheKey,
        payload as unknown as Record<string, unknown>,
        SEARCH_CACHE_TTL_MS,
        { maxEntries: SEARCH_CACHE_MAX_ENTRIES },
      );
      return {
        payload,
        serverTiming: timing.toHeader(),
      };
    })();

    SEARCH_IN_FLIGHT_LOADS.set(cacheKey, searchLoadPromise);
    let result: {
      payload: SearchRoutePayload;
      serverTiming: string;
      status?: number;
    };
    try {
      result = await searchLoadPromise;
    } finally {
      const currentLoad = SEARCH_IN_FLIGHT_LOADS.get(cacheKey);
      if (currentLoad === searchLoadPromise) {
        SEARCH_IN_FLIGHT_LOADS.delete(cacheKey);
      }
    }

    return NextResponse.json(result.payload, {
      status: result.status,
      headers: {
        "Cache-Control": SEARCH_CACHE_CONTROL,
        "Server-Timing": result.serverTiming,
      },
    });
  } catch (error) {
    logger.error("Search API error", error, { component: "search" });
    return NextResponse.json(
      {
        results: [],
        facets: [],
        total: 0,
        error: "Search failed",
      },
      { status: 500 }
    );
  }
}
