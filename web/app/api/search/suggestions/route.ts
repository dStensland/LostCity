import { NextRequest, NextResponse } from "next/server";
import {
  getSearchSuggestions,
  getSuggestionsWithCorrections,
} from "@/lib/search-suggestions";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Helper to safely parse integers with validation
function safeParseInt(
  value: string | null,
  defaultValue: number,
  min = 1,
  max = 100
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Search suggestions/autocomplete API endpoint.
 *
 * GET /api/search/suggestions
 *
 * Query parameters:
 * - q: Search query prefix (required, min 2 characters)
 * - limit: Maximum number of suggestions (default: 8, max: 20)
 * - corrections: If "true", include typo correction suggestions
 *
 * Response:
 * {
 *   suggestions: SearchSuggestion[],
 *   corrections?: SuggestionWithCorrection[]
 * }
 */
export async function GET(request: NextRequest) {
  // Rate limit: read endpoint (suggestions should be fast)
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
          error: "Query must be at least 2 characters",
        },
        { status: 400 }
      );
    }

    const limit = safeParseInt(searchParams.get("limit"), 8, 1, 20);
    const includeCorrections = searchParams.get("corrections") === "true";

    // Get suggestions, optionally with corrections
    if (includeCorrections) {
      const result = await getSuggestionsWithCorrections(query, limit, 3);
      return NextResponse.json(result, {
        headers: {
          // Longer cache for suggestions since they're based on materialized view
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    } else {
      const suggestions = await getSearchSuggestions(query, limit);
      return NextResponse.json(
        { suggestions },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }
  } catch (error) {
    logger.error("Suggestions API error:", error);
    return NextResponse.json(
      {
        suggestions: [],
        error: "Failed to get suggestions",
      },
      { status: 500 }
    );
  }
}
