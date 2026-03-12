import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { mapContestRow } from "@/lib/best-of-contests";

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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const ctx = await resolvePortalQueryContext(supabase, searchParams);
    if (!ctx.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("best_of_contests")
      .select("id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at")
      .eq("portal_id", ctx.portalId)
      .eq("status", "active")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Active contest fetch error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { contest: null },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    const contest = mapContestRow(data as Record<string, unknown>);

    return NextResponse.json(
      { contest },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Active contest API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
