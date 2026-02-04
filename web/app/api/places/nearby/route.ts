import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, parseFloatParam, parseIntParam, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

function getSupabase() {
  // Use anon key for public read-only endpoint (never service key for public routes)
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;
  const supabase = getSupabase();
  const params = req.nextUrl.searchParams;

  // Parse and validate numeric parameters
  const lat = parseFloatParam(params.get("lat"));
  const lng = parseFloatParam(params.get("lng"));
  const radius = parseIntParam(params.get("radius"), 2000);
  const category = params.get("category");
  const minScore = parseIntParam(params.get("minScore"), 40);

  // Validate coordinates
  if (lat === null || lng === null || lat === 0 || lng === 0) {
    return validationError("Valid lat and lng parameters are required");
  }

  // Validate other params
  if (radius === null || minScore === null) {
    return validationError("Invalid radius or minScore parameter");
  }

  // Use the database function for nearby places
  const { data, error } = await supabase.rpc("get_nearby_places", {
    p_lat: lat,
    p_lng: lng,
    p_radius: radius,
    p_category: category,
    p_min_score: minScore,
  });

  if (error) {
    return errorResponse(error, "places/nearby:GET");
  }

  return NextResponse.json({
    places: data,
    center: { lat, lng },
    radius,
  });
}
