import { NextRequest, NextResponse } from "next/server";
import { instantSearch } from "@/lib/unified-search";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
 * - portal: Portal ID for scoped search
 *
 * Response:
 * {
 *   suggestions: SearchResult[],  // Top matches for autocomplete
 *   topResults: SearchResult[],   // Additional results
 *   intent?: {                    // Detected query intent
 *     type: string,
 *     confidence: number,
 *     dateFilter?: string
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  // Rate limit: read endpoint
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.read);
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
          error: "Query must be at least 2 characters",
        },
        { status: 400 }
      );
    }

    const limit = safeParseInt(searchParams.get("limit"), 6, 1, 12);
    const portalId = searchParams.get("portal") || undefined;

    // Perform instant search
    const result = await instantSearch(query, {
      portalId,
      limit,
    });

    // Return with aggressive caching for fast autocomplete
    return NextResponse.json(result, {
      headers: {
        // Short cache with stale-while-revalidate for instant feel
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Instant search API error:", error);
    return NextResponse.json(
      {
        suggestions: [],
        topResults: [],
        error: "Search failed",
      },
      { status: 500 }
    );
  }
}
