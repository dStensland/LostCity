import { NextRequest, NextResponse } from "next/server";
import { loadResidencies } from "@/lib/music/residencies-loader";
import {
  applyRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Residencies are slow-moving editorial content — a weekly series rarely
// changes more than once a day, and the per-residency "next event" lookup
// is the expensive part. 300s (vs. the 60s used for show-level feeds)
// cuts DB load for these 7-ish reads without noticeably staling the view.
export const revalidate = 300;

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
    const payload = await loadResidencies(portal);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("GET /api/music/residencies failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ residencies: [] });
  }
}
