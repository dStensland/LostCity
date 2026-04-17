import { NextRequest, NextResponse } from "next/server";
import { loadThisWeek } from "@/lib/music/this-week-loader";
import {
  applyRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const revalidate = 60;

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
    const payload = await loadThisWeek(portal);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("GET /api/music/this-week failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ shows: [] });
  }
}
