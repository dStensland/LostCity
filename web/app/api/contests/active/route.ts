import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getActiveContestForPortal } from "@/lib/contests/get-feed-summary";

/**
 * GET /api/contests/active
 * Returns the currently active contest for a portal, if any.
 * Used by the feed to optionally show a contest hero card.
 * Query: ?portal=atlanta
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const portalSlug = searchParams.get("portal");
    if (!portalSlug) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const contest = await getActiveContestForPortal(portalSlug);

    if (!contest) {
      return NextResponse.json(
        { contest: null },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    return NextResponse.json(
      { contest },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Active contest API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
