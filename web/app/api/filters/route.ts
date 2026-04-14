import { NextResponse } from "next/server";
import { getAvailableFilters } from "@/lib/event-search";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { logger } from "@/lib/logger";

export const revalidate = 600; // Cache for 10 minutes
export const maxDuration = 30;

export async function GET(request: Request) {
  // Rate limit: read endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const filters = await getOrSetSharedCacheJson(
      "api-filters",
      "available",
      10 * 60 * 1000,
      () => getAvailableFilters(),
    );
    return NextResponse.json(filters, {
      headers: {
        // Filter options rarely change - cache for 10 minutes
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    logger.error("Error fetching available filters", error);
    return NextResponse.json(
      { error: "Failed to fetch filters" },
      { status: 500 }
    );
  }
}
