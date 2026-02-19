import { NextResponse } from "next/server";
import { getAvailableFilters } from "@/lib/search";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const revalidate = 600; // Cache for 10 minutes

export async function GET(request: Request) {
  // Rate limit: read endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const portalId = searchParams.get("portal_id") || undefined;
    const portalExclusive = searchParams.get("portal_exclusive") === "true";

    const filters = await getAvailableFilters({
      portalId,
      portalExclusive,
    });
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
