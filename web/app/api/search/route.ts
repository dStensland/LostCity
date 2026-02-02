import { NextRequest, NextResponse } from "next/server";
import { unifiedSearch, type SearchOptions } from "@/lib/unified-search";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

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
 * - portal: Portal ID for scoped search
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
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  try {
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

    const portalId = searchParams.get("portal") || undefined;

    // Build search options
    const options: SearchOptions = {
      query,
      types,
      limit,
      offset,
      categories,
      subcategories,
      tags,
      neighborhoods,
      dateFilter,
      isFree,
      portalId,
    };

    // Perform search
    const result = await unifiedSearch(options);

    // Return with caching headers
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
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
