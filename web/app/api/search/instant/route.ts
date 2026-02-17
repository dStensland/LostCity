import { NextRequest, NextResponse } from "next/server";
import { instantSearch } from "@/lib/unified-search";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import {
  type SearchContext,
  rankResults,
  detectQuickActions,
  groupResultsByType,
  getGroupDisplayOrder,
} from "@/lib/search-ranking";
import type { ViewMode, FindType } from "@/lib/search-context";
import { logger } from "@/lib/logger";

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
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);
    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        {
          suggestions: [],
          topResults: [],
          quickActions: [],
          groupedResults: {},
          groupOrder: [],
          error: "portal and portal_id parameters must reference the same portal",
        },
        { status: 400 }
      );
    }
    const portalId = portalContext.portalId || undefined;
    const portalSlug = portalContext.portalSlug || searchParams.get("portalSlug") || "atlanta";
    const viewMode = (searchParams.get("viewMode") as ViewMode) || "feed";
    const findType = (searchParams.get("findType") as FindType) || null;

    // Build search context
    const context: SearchContext = {
      viewMode,
      findType,
      portalSlug,
      portalId,
    };

    // Perform instant search
    const result = await instantSearch(query, {
      portalId,
      limit: limit * 2, // Get more results for grouping
    });

    // Apply context-aware ranking
    const rankedResults = rankResults(result.suggestions, context);

    // Detect quick actions based on query
    const quickActions = detectQuickActions(query, portalSlug);

    // Group results by type
    const groupedResults = groupResultsByType(rankedResults);

    // Get display order based on context
    const groupOrder = getGroupDisplayOrder(context);

    // Build response with facet counts
    const facets = result.facets ?? [];
    const response = {
      suggestions: rankedResults.slice(0, limit),
      topResults: rankedResults.slice(limit, limit * 2),
      quickActions,
      groupedResults,
      groupOrder,
      facets,
      intent: result.intent,
    };

    // Return with aggressive caching for fast autocomplete
    return NextResponse.json(response, {
      headers: {
        // Short cache with stale-while-revalidate for instant feel
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
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
