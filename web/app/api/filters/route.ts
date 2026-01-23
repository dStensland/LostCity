import { NextResponse } from "next/server";
import { getAvailableFilters } from "@/lib/search";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const revalidate = 600; // Cache for 10 minutes

export async function GET(request: Request) {
  // Rate limit: read endpoint
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  try {
    const filters = await getAvailableFilters();
    return NextResponse.json(filters, {
      headers: {
        // Filter options rarely change - cache for 10 minutes
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("Error fetching available filters:", error);
    return NextResponse.json(
      { error: "Failed to fetch filters" },
      { status: 500 }
    );
  }
}
