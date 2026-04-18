import { NextRequest, NextResponse } from "next/server";
import { loadByVenue } from "@/lib/music/by-venue-loader";
import {
  applyRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Music shows for a given day rarely change intra-day after doors are set;
// 60s keeps the by-venue view fresh for feed reads without hammering the DB.
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

  const pinnedSlugs = url.searchParams.getAll("pinned");
  const includeAdditional =
    url.searchParams.get("include_additional") === "true";

  try {
    const payload = await loadByVenue(portal, {
      date,
      pinned_slugs: pinnedSlugs,
      include_additional: includeAdditional,
    });
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("GET /api/music/by-venue failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({
      date: date ?? "",
      my_venues: [],
      editorial: [],
      marquee: [],
      additional: [],
    });
  }
}
