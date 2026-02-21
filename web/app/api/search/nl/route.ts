import { NextRequest, NextResponse } from "next/server";
import { unifiedSearch, type SearchOptions } from "@/lib/unified-search";
import { applyRateLimit, applyDailyQuota, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseNaturalLanguageQuery, convertToSearchOptions, type NLSearchContext } from "@/lib/nl-search";
import { logger } from "@/lib/logger";

const VALID_TYPES = ["event", "venue", "organizer", "series", "list"] as const;
type ValidType = (typeof VALID_TYPES)[number];

/**
 * Natural Language Search API endpoint.
 *
 * POST /api/search/nl
 *
 * Body: { query: string, portalId?: string, types?: string[] }
 *
 * Parses a natural language query into structured filters via gpt-4o-mini,
 * then feeds those filters into the existing unifiedSearch() engine.
 * Falls back to keyword search on LLM timeout or error.
 *
 * Kill switch: set ENABLE_NL_SEARCH=false to disable. Returns 503 and the
 * client falls back to standard keyword search automatically.
 */
export async function POST(request: NextRequest) {
  // Kill switch — disable NL search without a deploy
  if (process.env.ENABLE_NL_SEARCH === "false") {
    return NextResponse.json(
      { results: [], facets: [], total: 0, nlContext: null, error: "NL search is disabled" },
      { status: 503 }
    );
  }

  const clientId = getClientIdentifier(request);

  // Per-minute rate limit: 20 NL searches/min per IP
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.nlSearch,
    clientId,
    { bucket: "search:nl", logContext: "search:nl" }
  );
  if (rateLimitResult) return rateLimitResult;

  // Daily quota: cap total LLM calls per IP to control costs.
  // Default 200/day — override with RATE_LIMIT_NL_SEARCH_DAILY_LIMIT env var.
  const dailyLimit = Number.parseInt(
    process.env.RATE_LIMIT_NL_SEARCH_DAILY_LIMIT || "200",
    10
  );
  const dailyQuotaResult = await applyDailyQuota(request, dailyLimit, clientId, {
    bucket: "search:nl",
    logContext: "search:nl",
  });
  if (dailyQuotaResult) return dailyQuotaResult;

  let body: { query: string; portalId?: string; types?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { results: [], facets: [], total: 0, nlContext: null, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { query, portalId } = body;

  if (!query || typeof query !== "string" || query.trim().length < 4) {
    return NextResponse.json(
      { results: [], facets: [], total: 0, nlContext: null, error: "Query must be at least 4 characters" },
      { status: 400 }
    );
  }

  const trimmedQuery = query.trim();

  // Validate types if provided
  const types = Array.isArray(body.types)
    ? (body.types.filter((t): t is ValidType => VALID_TYPES.includes(t as ValidType)) as ValidType[])
    : undefined;

  try {
    // Attempt LLM parse with timeout (2.5s built into parseNaturalLanguageQuery)
    let nlContext: NLSearchContext;
    let searchOptions: SearchOptions;

    try {
      const parsed = await parseNaturalLanguageQuery(trimmedQuery);
      searchOptions = convertToSearchOptions(parsed, {
        portalId: portalId || undefined,
        types: types?.length ? types : undefined,
      });
      nlContext = {
        explanation: parsed.explanation,
        chips: parsed.suggestedChips || [],
        parsedFilters: parsed,
      };
    } catch (err) {
      // LLM failed or timed out — fall back to keyword search
      logger.warn("NL parse failed, falling back to keyword search", {
        component: "search:nl",
        query: trimmedQuery,
        error: err instanceof Error ? err.message : "unknown",
      });

      searchOptions = {
        query: trimmedQuery,
        useIntentAnalysis: true,
        boostExactMatches: true,
        includeFacets: true,
      };
      if (portalId) searchOptions.portalId = portalId;
      if (types?.length) searchOptions.types = types;

      nlContext = {
        explanation: "",
        chips: [],
        parsedFilters: { searchTerms: trimmedQuery, explanation: "" },
        fallback: true,
      };
    }

    // Set reasonable defaults
    if (!searchOptions.limit) searchOptions.limit = 20;

    // Execute search through the existing unified search engine
    const result = await unifiedSearch(searchOptions);

    return NextResponse.json({
      ...result,
      nlContext,
    });
  } catch (error) {
    logger.error("NL Search API error", error, { component: "search:nl" });
    return NextResponse.json(
      {
        results: [],
        facets: [],
        total: 0,
        nlContext: null,
        error: "Search failed",
      },
      { status: 500 }
    );
  }
}
