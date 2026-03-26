import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  errorResponse,
  isValidString,
  parseIntParam,
  escapeSQLPattern,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";

export const dynamic = "force-dynamic";

// GET /api/artists?portal=arts-atlanta&discipline=visual_artist&medium=photography&q=search&limit=20&offset=0
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portalParam = searchParams.get("portal");
  if (!portalParam || !isValidString(portalParam, 1, 50)) {
    return NextResponse.json(
      { error: "portal parameter is required" },
      { status: 400 }
    );
  }

  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 20, 100);
  const offset = Math.max(parseIntParam(searchParams.get("offset")) ?? 0, 0);
  const discipline = searchParams.get("discipline") ?? "visual_artist";
  const medium = searchParams.get("medium");
  const q = searchParams.get("q");

  try {
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(
      supabase,
      searchParams,
      getVerticalFromRequest(request)
    );
    if (!portalContext.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const { data, error } = await supabase.rpc("get_portal_artists", {
      p_portal_id: portalContext.portalId,
      p_limit: limit,
      p_offset: offset,
      p_discipline: isValidString(discipline, 1, 50) ? discipline : "visual_artist",
      p_medium: medium && isValidString(medium, 1, 50) ? medium : null,
      p_q: q && isValidString(q, 1, 200) ? escapeSQLPattern(q) : null,
    } as never);

    if (error) {
      return errorResponse(error, "GET /api/artists");
    }

    type ArtistRow = {
      id: string;
      name: string;
      slug: string;
      discipline: string;
      bio: string | null;
      image_url: string | null;
      website: string | null;
      is_verified: boolean;
      exhibition_count: number;
      total_count: number;
    };

    const rows = (data ?? []) as ArtistRow[];
    const total = rows.length > 0 ? rows[0].total_count : 0;

    // Strip total_count from individual rows (it's a window function artifact)
    const artists = rows.map(({ total_count, ...artist }) => artist);

    return NextResponse.json(
      { artists, total, offset, limit },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/artists");
  }
}
