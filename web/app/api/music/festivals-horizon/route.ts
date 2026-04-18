import { NextRequest, NextResponse } from "next/server";
import { loadFestivalsHorizon } from "@/lib/music/festivals-horizon-loader";
import {
  applyRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Festival announcements change on the order of days, not minutes — a new
// lineup drops or a date shifts maybe once a week. 1 hour of edge cache
// dramatically cuts DB load for the 90-day window query without noticeably
// staling the horizon view.
export const revalidate = 3600;

export async function GET(
  request: NextRequest,
): Promise<NextResponse | Response> {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");

  if (!portal) {
    return NextResponse.json(
      { error: "portal query param is required" },
      { status: 400 },
    );
  }

  try {
    const payload = await loadFestivalsHorizon(portal);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("GET /api/music/festivals-horizon failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ festivals: [] });
  }
}
