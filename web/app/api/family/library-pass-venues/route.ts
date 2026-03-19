import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { isValidString } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/family/library-pass-venues
 *
 * Returns venues with library_pass.eligible = true.
 * Used by the family portal's "Free with Library Card" discovery section.
 *
 * Query params:
 *   portal  (optional) portal slug — scopes results to portal's cities.
 *           Defaults to "atlanta" city scope if not provided.
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const portalParam = searchParams.get("portal");

    // Resolve portal cities — default to ["atlanta"] if no portal specified
    let portalCities: string[] = ["atlanta"];
    if (portalParam && isValidString(portalParam, 1, 80)) {
      const portal = await getPortalBySlug(portalParam);
      if (portal) {
        const filters = portal.filters as { city?: string; cities?: string[] } | null;
        const resolved = [
          ...(filters?.cities ?? []),
          ...(filters?.city ? [filters.city] : []),
        ].filter(Boolean);
        if (resolved.length > 0) {
          portalCities = resolved;
        }
      }
    }

    type VenueRow = {
      id: number;
      name: string;
      slug: string | null;
      venue_type: string | null;
      neighborhood: string | null;
      image_url: string | null;
      short_description: string | null;
      library_pass: { eligible?: boolean; program?: string; benefit?: string; passes_per_checkout?: number | null; notes?: string | null; url?: string } | null;
    };

    const result = await supabase
      .from("venues")
      .select("id, name, slug, venue_type, neighborhood, image_url, short_description, library_pass")
      .eq("active", true)
      .in("city", portalCities)
      .not("library_pass", "is", null)
      .order("name", { ascending: true });

    if (result.error) {
      console.error("[library-pass-venues] query failed:", result.error.message);
      return NextResponse.json({ error: "Failed to fetch venues" }, { status: 500 });
    }

    const rows = (result.data as unknown as VenueRow[]) ?? [];

    // Filter to only eligible venues (library_pass.eligible === true)
    const eligible = rows.filter(
      (v) => v.library_pass?.eligible === true
    );

    return NextResponse.json(
      { venues: eligible },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("[library-pass-venues] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
