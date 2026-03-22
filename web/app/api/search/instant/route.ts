import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
import {
  TRENDING_SEARCHES,
  type PreSearchPayload,
  type PreSearchPopularEvent,
} from "@/lib/search-presearch";

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

// Pre-search (empty query) constants
const PRE_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PRE_SEARCH_CACHE_NAMESPACE = "api:search-presearch";
const PRE_SEARCH_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

async function buildPreSearchPayload(
  portalId: string | undefined,
  portalSlug: string,
  portalCity: string | undefined,
): Promise<PreSearchPayload> {
  const serviceClient = createServiceClient();
  const now = new Date().toISOString();

  // Fetch top search suggestions by frequency (for trending pills)
  // and top quality upcoming events (for popular cards) in parallel
  const [suggestionsResult, eventsResult] = await Promise.allSettled([
    serviceClient
      .from("search_suggestions")
      .select("suggestion, type, frequency")
      .in("type", ["event", "venue", "vibe", "tag"])
      .gt("frequency", 1)
      .order("frequency", { ascending: false })
      .limit(20),
    (() => {
      let q = serviceClient
        .from("events")
        .select(
          "id, title, start_date, start_time, is_free, image_url, venues!inner(name)"
        )
        .gte("start_date", now.slice(0, 10))
        .eq("is_active", true)
        .not("title", "is", null)
        .order("data_quality", { ascending: false })
        .limit(4);
      if (portalId) {
        q = q.eq("portal_id", portalId);
      } else if (portalCity) {
        q = q.eq("city", portalCity);
      }
      return q;
    })(),
  ]);

  // Build trending list: merge curated with DB suggestions, dedupe, keep top 8
  const dbTrending: string[] = [];
  if (suggestionsResult.status === "fulfilled" && suggestionsResult.value.data) {
    for (const row of suggestionsResult.value.data) {
      const text = (row as { suggestion: string }).suggestion;
      if (text && text.length >= 3 && text.length <= 30) {
        dbTrending.push(text);
      }
    }
  }

  const seen = new Set<string>();
  const trending: string[] = [];
  for (const term of [...TRENDING_SEARCHES, ...dbTrending]) {
    const key = term.toLowerCase();
    if (!seen.has(key) && trending.length < 8) {
      seen.add(key);
      trending.push(term);
    }
  }

  // Build popular now cards
  const popularNow: PreSearchPopularEvent[] = [];
  if (eventsResult.status === "fulfilled" && eventsResult.value.data) {
    for (const row of eventsResult.value.data.slice(0, 2)) {
      const r = row as {
        id: string;
        title: string;
        start_date: string | null;
        start_time: string | null;
        is_free: boolean | null;
        image_url: string | null;
        venues: { name: string } | { name: string }[] | null;
      };
      const venueName = Array.isArray(r.venues)
        ? (r.venues[0]?.name ?? null)
        : (r.venues?.name ?? null);
      popularNow.push({
        id: r.id,
        title: r.title,
        venueName,
        startDate: r.start_date,
        startTime: r.start_time,
        isFree: r.is_free === true,
        imageUrl: r.image_url,
        href: `/${portalSlug}/events/${r.id}`,
      });
    }
  }

  return { trending, popularNow };
}
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
 * - q: Search query (optional; when absent or < 2 chars, returns pre-search discovery data)
 * - limit: Maximum number of results per section (default: 6, max: 12)
 * - portal: Portal slug for scoped search (canonical)
 * - portal_id: Portal UUID for scoped search
 * - portalSlug: Optional portal slug override for URL generation
 * - viewMode: Current view mode (feed, find, community)
 * - findType: Current find type (events, classes, destinations)
 *
 * Response (q empty / < 2 chars):
 * { preSearch: { trending: string[], popularNow: PreSearchPopularEvent[] } }
 *
 * Response (q >= 2 chars):
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

    // ── Pre-search: empty query → return discovery data, not 400 ──────────
    if (!query || query.trim().length < 2) {
      // Resolve portal context for scoping
      const supabase = await createClient();
      const verticalOpts = getVerticalFromRequest(request);
      const portalContext = await (async () => {
        const cached = await getCachedPortalQueryContext(searchParams, verticalOpts);
        if (cached) return cached;
        return resolvePortalQueryContext(supabase, searchParams, verticalOpts);
      })();

      const portalId = portalContext.portalId || undefined;
      const portalSlug =
        portalContext.portalSlug || searchParams.get("portalSlug") || "atlanta";
      const portalCity = portalContext.filters.city || undefined;

      const preSearchCacheKey = `${portalSlug}:${portalId ?? "global"}`;
      const cachedPreSearch = await getSharedCacheJson<PreSearchPayload>(
        PRE_SEARCH_CACHE_NAMESPACE,
        preSearchCacheKey,
      );
      if (cachedPreSearch) {
        return NextResponse.json(
          { preSearch: cachedPreSearch },
          {
            headers: {
              "Cache-Control": PRE_SEARCH_CACHE_CONTROL,
              "Server-Timing": timing.toHeader(),
            },
          }
        );
      }

      try {
        const preSearch = await buildPreSearchPayload(portalId, portalSlug, portalCity);
        await setSharedCacheJson(PRE_SEARCH_CACHE_NAMESPACE, preSearchCacheKey, preSearch, PRE_SEARCH_CACHE_TTL_MS);
        return NextResponse.json(
          { preSearch },
          {
            headers: {
              "Cache-Control": PRE_SEARCH_CACHE_CONTROL,
              "Server-Timing": timing.toHeader(),
            },
          }
        );
      } catch (preSearchError) {
        logger.error("Pre-search API error:", preSearchError);
        // Fall back to curated data on error
        const fallback: PreSearchPayload = { trending: TRENDING_SEARCHES, popularNow: [] };
        return NextResponse.json(
          { preSearch: fallback },
          {
            headers: {
              "Cache-Control": "public, s-maxage=30",
              "Server-Timing": timing.toHeader(),
            },
          }
        );
      }
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
