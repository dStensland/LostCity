import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/exhibitions/:slug?portal=arts-atlanta
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  if (!isValidString(slug, 1, 200)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exhibitions")
      .select(
        `
        id,
        slug,
        place_id,
        source_id,
        portal_id,
        title,
        description,
        image_url,
        opening_date,
        closing_date,
        medium,
        exhibition_type,
        admission_type,
        admission_url,
        source_url,
        tags,
        is_active,
        metadata,
        created_at,
        updated_at,
        venue:places(id, name, slug, neighborhood, address, city, lat, lng, image_url),
        artists:exhibition_artists(exhibition_id, artist_name, artist_url, artist_id, role)
      `
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return errorResponse(error, "GET /api/exhibitions/:slug");
    if (!data) {
      return NextResponse.json({ error: "Exhibition not found" }, { status: 404 });
    }

    return NextResponse.json(
      { exhibition: data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/exhibitions/:slug");
  }
}
