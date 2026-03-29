import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/find/right-now
 *
 * Returns a temporally-ranked mix of upcoming events and open places for the
 * unified Find stream's "Right Now" section. Events are scored by how soon
 * they start (within ±3 hours); places are scored by quality (final_score).
 *
 * Query params:
 *   portal  — portal slug (default: "atlanta")
 *   limit   — max results 1–12 (default: 6)
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portalSlug = searchParams.get("portal") || "atlanta";
  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 6, 12);

  try {
    const supabase = await createClient();
    const portal = await getPortalBySlug(portalSlug);
    const city = (portal?.filters as { city?: string } | null)?.city || "Atlanta";

    const { data, error } = await supabase.rpc("get_right_now_feed", {
      p_portal_id: portal?.id ?? null,
      p_city: city,
      p_limit: limit,
    } as never);

    if (error) {
      console.error("[right-now] RPC error:", error);
      return NextResponse.json([], { status: 500 });
    }

    return NextResponse.json(data ?? [], {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("[right-now] unexpected error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
