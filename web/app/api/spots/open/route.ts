import { NextRequest, NextResponse } from "next/server";
import { getOpenSpots } from "@/lib/spots";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;
  const searchParams = request.nextUrl.searchParams;
  const types = searchParams.get("types")?.split(",").filter(Boolean);
  const neighborhood = searchParams.get("neighborhood") || undefined;
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    const spots = await getOpenSpots(types, neighborhood, limit);

    return NextResponse.json({
      spots,
      count: spots.length,
    });
  } catch (error) {
    logger.error("Error fetching open spots:", error);
    return NextResponse.json(
      { error: "Failed to fetch open spots" },
      { status: 500 }
    );
  }
}
