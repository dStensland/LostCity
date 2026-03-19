import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/programs/slug?slug=swim-lessons-spring&portal=atlanta-families
// Fetch a single program by slug, scoped to a portal.
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const portalParam = searchParams.get("portal");

  if (!slug || !isValidString(slug, 1, 200)) {
    return NextResponse.json({ error: "slug parameter is required" }, { status: 400 });
  }

  if (!portalParam || !isValidString(portalParam, 1, 50)) {
    return NextResponse.json({ error: "portal parameter is required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Resolve portal
    const { data: portalRow } = await supabase
      .from("portals")
      .select("id")
      .eq("slug", portalParam)
      .eq("is_active", true)
      .maybeSingle();

    const portal = portalRow as { id: string } | null;

    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const { data: program, error } = await supabase
      .from("programs")
      .select(
        `
        id,
        portal_id,
        source_id,
        venue_id,
        name,
        slug,
        description,
        program_type,
        provider_name,
        age_min,
        age_max,
        season,
        session_start,
        session_end,
        schedule_days,
        schedule_start_time,
        schedule_end_time,
        cost_amount,
        cost_period,
        cost_notes,
        registration_status,
        registration_opens,
        registration_closes,
        registration_url,
        before_after_care,
        lunch_included,
        tags,
        status,
        created_at,
        updated_at,
        venue:venues(id, name, neighborhood, address, city, state, lat, lng, image_url, slug, phone, website)
      `
      )
      .eq("slug", slug)
      .eq("portal_id", portal.id)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      return errorResponse(error, "GET /api/programs/slug");
    }

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json(
      { program },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/programs/slug");
  }
}
