import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { computeMoments } from "@/lib/moments";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    // Default to atlanta for now; could accept ?portal= in the future
    const portalSlug = request.nextUrl.searchParams.get("portal") || "atlanta";
    const data = await computeMoments(portalSlug);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Error in moments API:", error);
    return NextResponse.json(
      {
        takeover: null,
        imminent: [],
        upcoming: [],
        saveTheDate: [],
        timeContext: {
          timeOfDay: "evening",
          season: "spring",
          isWeekend: false,
          sectionLabel: null,
          sectionCategories: [],
        },
      },
      { status: 500 }
    );
  }
}
