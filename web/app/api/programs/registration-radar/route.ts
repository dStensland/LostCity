import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString, parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";

export const dynamic = "force-dynamic";

// GET /api/programs/registration-radar?portal=hooky
// Returns programs grouped by registration urgency:
//   opening_soon  — upcoming, registration_opens within 14 days
//   closing_soon  — open, registration_closes within 7 days
//   filling_fast  — waitlist
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

  const ageFilter = parseIntParam(searchParams.get("age"));

  try {
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);

    if (!portalContext.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }

    const portalId = portalContext.portalId;
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const today = now.toISOString().split("T")[0];

    const programSelect = `
      id,
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
      cost_amount,
      cost_period,
      cost_notes,
      registration_status,
      registration_opens,
      registration_closes,
      registration_url,
      tags,
      venue:venues(id, name, neighborhood, address, city, lat, lng, image_url)
    `;

    // Build each query individually — applying the optional age filter inline
    // to avoid TypeScript generic constraint issues with Supabase's query builder.

    let openingSoonQ = supabase
      .from("programs")
      .select(programSelect)
      .eq("portal_id", portalId)
      .eq("status", "active")
      .eq("registration_status", "upcoming")
      .gte("registration_opens", today)
      .lte("registration_opens", in14Days)
      .order("registration_opens", { ascending: true })
      .limit(20);

    let closingSoonQ = supabase
      .from("programs")
      .select(programSelect)
      .eq("portal_id", portalId)
      .eq("status", "active")
      .eq("registration_status", "open")
      .gte("registration_closes", today)
      .lte("registration_closes", in7Days)
      .order("registration_closes", { ascending: true })
      .limit(20);

    let fillingFastQ = supabase
      .from("programs")
      .select(programSelect)
      .eq("portal_id", portalId)
      .eq("status", "active")
      .eq("registration_status", "waitlist")
      .order("session_start", { ascending: true, nullsFirst: false })
      .limit(20);

    if (ageFilter !== null) {
      openingSoonQ = openingSoonQ
        .or(`age_min.is.null,age_min.lte.${ageFilter}`)
        .or(`age_max.is.null,age_max.gte.${ageFilter}`);
      closingSoonQ = closingSoonQ
        .or(`age_min.is.null,age_min.lte.${ageFilter}`)
        .or(`age_max.is.null,age_max.gte.${ageFilter}`);
      fillingFastQ = fillingFastQ
        .or(`age_min.is.null,age_min.lte.${ageFilter}`)
        .or(`age_max.is.null,age_max.gte.${ageFilter}`);
    }

    const [openingSoonResult, closingSoonResult, fillingFastResult] =
      await Promise.all([openingSoonQ, closingSoonQ, fillingFastQ]);

    if (openingSoonResult.error) {
      return errorResponse(openingSoonResult.error, "GET /api/programs/registration-radar (opening_soon)");
    }
    if (closingSoonResult.error) {
      return errorResponse(closingSoonResult.error, "GET /api/programs/registration-radar (closing_soon)");
    }
    if (fillingFastResult.error) {
      return errorResponse(fillingFastResult.error, "GET /api/programs/registration-radar (filling_fast)");
    }

    const openingSoon = openingSoonResult.data ?? [];
    const closingSoon = closingSoonResult.data ?? [];
    const fillingFast = fillingFastResult.data ?? [];

    return NextResponse.json(
      {
        opening_soon: openingSoon,
        closing_soon: closingSoon,
        filling_fast: fillingFast,
        total:
          openingSoon.length + closingSoon.length + fillingFast.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/programs/registration-radar");
  }
}
