import { NextRequest, NextResponse } from "next/server";
import { loadByShow } from "@/lib/music/by-show-loader";
import {
  applyRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { parseIntParam } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Show dates/times change slowly once posted; 60s keeps the chronological
// by-show view fresh for feed reads without hammering the DB on every load.
export const revalidate = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 30;

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

  const rawDays = parseIntParam(url.searchParams.get("days"), DEFAULT_DAYS);
  const days =
    rawDays === null
      ? DEFAULT_DAYS
      : Math.min(Math.max(rawDays, MIN_DAYS), MAX_DAYS);

  try {
    const payload = await loadByShow(portal, { date, days });
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("GET /api/music/by-show failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ groups: [] });
  }
}
