import { NextRequest, NextResponse } from "next/server";
import { loadTonight } from "@/lib/music/tonight-loader";
import {
  applyRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Shows schedule changes hourly; doors_time updates daily. 60s keeps the
// tonight/late-night split fresh enough for a feed-layer read without
// hammering the database on every page load.
export const revalidate = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const dateParam = url.searchParams.get("date");
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : undefined;

  try {
    const payload = await loadTonight(portal, date);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("GET /api/music/tonight failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({
      date: date ?? "",
      tonight: [],
      late_night: [],
    });
  }
}
