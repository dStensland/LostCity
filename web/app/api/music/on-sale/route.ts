import { NextRequest, NextResponse } from "next/server";
import { loadOnSale } from "@/lib/music/on-sale-loader";
import {
  applyRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { parseIntParam } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Recently-announced shows move on announcement cadence (not daily); a 10-min
// revalidate keeps the "Just Announced" surface fresh enough to reflect new
// on-sales without hammering the DB on every feed read.
export const revalidate = 600;

const DEFAULT_LIMIT = 30;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

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

  const rawLimit = parseIntParam(url.searchParams.get("limit"), DEFAULT_LIMIT);
  const limit =
    rawLimit === null
      ? DEFAULT_LIMIT
      : Math.min(Math.max(rawLimit, MIN_LIMIT), MAX_LIMIT);

  try {
    const payload = await loadOnSale(portal, limit);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("GET /api/music/on-sale failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ shows: [] });
  }
}
