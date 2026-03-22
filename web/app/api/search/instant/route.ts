import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  getCachedPortalQueryContext,
  resolvePortalQueryContext,
  getVerticalFromRequest,
} from "@/lib/portal-query-context";
import type { ViewMode, FindType } from "@/lib/search-context";
import { logger } from "@/lib/logger";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { buildStableInstantSearchCacheKey } from "@/lib/search-cache-key";
import { createServerTimingRecorder } from "@/lib/server-timing";
import {
  buildInstantSearchPayload,
  type InstantSearchEntityType,
} from "@/lib/instant-search-service";

// Helper to safely parse integers with validation
function safeParseInt(
  value: string | null,
  defaultValue: number,
  min = 1,
  max = 20
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

const INSTANT_SEARCH_CACHE_TTL_MS = 30 * 1000;
const INSTANT_SEARCH_CACHE_MAX_ENTRIES = 200;
const INSTANT_SEARCH_CACHE_NAMESPACE = "api:search-instant";
const INSTANT_SEARCH_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=60";
const INSTANT_SEARCH_IN_FLIGHT_LOADS = new Map<
  string,
  Promise<{
    payload: Record<string, unknown>;
    serverTiming: string;
    status?: number;
  }>
>();

/**
 * Instant search API endpoint.
 * Combines suggestions + top results in a single optimized call.
 * Designed for low-latency autocomplete/search-as-you-type UX.
 *
 * GET /api/search/instant
 *
 * Query parameters:
 * - q: Search query (required, min 2 characters)
 * - limit: Maximum number of results per section (default: 6, max: 12)
 * - portal: Portal slug for scoped search (canonical)
 * - portal_id: Portal UUID for scoped search
 * - portalSlug: Optional portal slug override for URL generation
 * - viewMode: Current view mode (feed, find, community)
 * - findType: Current find type (events, classes, destinations)
 *
 * Response:
 * {
 *   suggestions: SearchResult[],  // Top matches for autocomplete
 *   topResults: SearchResult[],   // Additional results
 *   quickActions: QuickAction[],  // Context-aware quick actions
 *   groupedResults: Record<string, SearchResult[]>,  // Results grouped by type
 *   groupOrder: string[],         // Display order for groups
 *   intent?: {                    // Detected query intent
 *     type: string,
 *     confidence: number,
 *     dateFilter?: string
 *   }
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
          suggestions: [],
          topResults: [],
          quickActions: [],
          groupedResults: {},
          groupOrder: [],
          error: "Query must be at least 2 characters",
        },
        { status: 400 }
      );
    }

    const limit = safeParseInt(searchParams.get("limit"), 6, 1, 12);
    const viewMode = (searchParams.get("viewMode") as ViewMode) || "feed";
    const findType = (searchParams.get("findType") as FindType) || null;
    const includeOrganizers = searchParams.get("include_organizers") === "true";
    const typesParam = searchParams.get("types");
    const validTypes = [
      "event",
      "venue",
      "organizer",
      "series",
      "list",
      "festival",
      "program",
    ] as const;
    const requestedTypes = typesParam
      ? (typesParam
          .split(",")
          .filter((value) =>
            validTypes.includes(value as (typeof validTypes)[number]),
          ) as (
            | "event"
            | "venue"
            | "organizer"
            | "series"
            | "list"
            | "festival"
            | "program"
          )[])
      : undefined;

    const cacheKey = buildStableInstantSearchCacheKey(searchParams);

    const cachedPayload = await timing.measure("cache_lookup", () =>
      getSharedCacheJson<Record<string, unknown>>(
        INSTANT_SEARCH_CACHE_NAMESPACE,
        cacheKey,
      )
    );
    if (cachedPayload) {
      timing.addMetric("cache_hit", 0, "shared");
      return NextResponse.json(cachedPayload, {
        headers: {
          "Cache-Control": INSTANT_SEARCH_CACHE_CONTROL,
          "Server-Timing": timing.toHeader(),
        },
      });
    }

    const existingLoad = INSTANT_SEARCH_IN_FLIGHT_LOADS.get(cacheKey);
    if (existingLoad) {
      const result = await existingLoad;
      timing.addMetric("coalesced", 0, "inflight");
      return NextResponse.json(result.payload, {
        headers: {
          "Cache-Control": INSTANT_SEARCH_CACHE_CONTROL,
          "Server-Timing": `${result.serverTiming}, ${timing.toHeader()}`,
        },
      });
    }

    const searchLoadPromise = (async (): Promise<{
      payload: Record<string, unknown>;
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
            suggestions: [],
            topResults: [],
            quickActions: [],
            groupedResults: {},
            groupOrder: [],
            error: "portal and portal_id parameters must reference the same portal",
          },
          serverTiming: timing.toHeader(),
          status: 400,
        };
      }
      const portalId = portalContext.portalId || undefined;
      const portalSlug =
        portalContext.portalSlug || searchParams.get("portalSlug") || "atlanta";

        const payload = await buildInstantSearchPayload({
          query,
          limit,
          portalId: portalId ?? null,
          portalSlug,
          portalCity: portalContext.filters.city || undefined,
          viewMode,
          findType,
          includeOrganizers,
          requestedTypes: requestedTypes as InstantSearchEntityType[] | undefined,
          timing,
        });
        await setSharedCacheJson(
          INSTANT_SEARCH_CACHE_NAMESPACE,
          cacheKey,
          payload,
          INSTANT_SEARCH_CACHE_TTL_MS,
          { maxEntries: INSTANT_SEARCH_CACHE_MAX_ENTRIES },
        );

        return {
          payload,
          serverTiming: timing.toHeader(),
        };
      })();

    INSTANT_SEARCH_IN_FLIGHT_LOADS.set(cacheKey, searchLoadPromise);
    let result: {
      payload: Record<string, unknown>;
      serverTiming: string;
      status?: number;
    };
    try {
      result = await searchLoadPromise;
    } finally {
      const currentLoad = INSTANT_SEARCH_IN_FLIGHT_LOADS.get(cacheKey);
      if (currentLoad === searchLoadPromise) {
        INSTANT_SEARCH_IN_FLIGHT_LOADS.delete(cacheKey);
      }
    }

    // Return with aggressive caching for fast autocomplete
    return NextResponse.json(result.payload, {
      status: result.status,
      headers: {
        "Cache-Control": INSTANT_SEARCH_CACHE_CONTROL,
        "Server-Timing": result.serverTiming,
      },
    });
  } catch (error) {
    logger.error("Instant search API error:", error);
    return NextResponse.json(
      {
        suggestions: [],
        topResults: [],
        quickActions: [],
        groupedResults: {},
        groupOrder: [],
        error: "Search failed",
      },
      { status: 500 }
    );
  }
}
