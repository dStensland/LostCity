import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/studios?city=Atlanta&type=shared&status=open
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const cityFilter = searchParams.get("city") ?? "Atlanta";
  const typeFilter = searchParams.get("type");
  const statusFilter = searchParams.get("status");

  try {
    const supabase = await createClient();

    let query = supabase
      .from("places")
      .select(
        `
        id, name, slug, address, neighborhood, city, state,
        lat, lng, place_type, website, description, image_url, vibes,
        studio_type, availability_status, monthly_rate_range, studio_application_url
      `
      )
      .not("studio_type", "is", null)
      .eq("is_active", true);

    if (cityFilter && isValidString(cityFilter, 1, 100)) {
      query = query.eq("city", cityFilter);
    }

    if (typeFilter && isValidString(typeFilter, 1, 30)) {
      query = query.eq("studio_type", typeFilter);
    }

    if (statusFilter && isValidString(statusFilter, 1, 30)) {
      query = query.eq("availability_status", statusFilter);
    }

    query = query.order("name", { ascending: true });

    const { data, error } = await query;

    if (error) {
      return errorResponse(error, "GET /api/studios");
    }

    return NextResponse.json(
      { studios: data ?? [], total: (data ?? []).length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/studios");
  }
}
