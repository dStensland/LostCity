import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;
  const supabase = getSupabase();
  const { slug } = await params;
  const searchParams = req.nextUrl.searchParams;
  const category = searchParams.get("category");

  // Get hospital
  const { data: hospital, error: hospitalError } = await supabase
    .from("hospitals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (hospitalError || !hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  // Get nearby places from materialized view (fast)
  let query = supabase
    .from("hospital_nearby_places")
    .select("*")
    .eq("hospital_id", hospital.id)
    .order("distance_meters");

  if (category) {
    query = query.eq("category_id", category);
  }

  const { data, error } = await query.limit(30);

  if (error) {
    return errorResponse(error, "places/hospital:GET");
  }

  return NextResponse.json({
    hospital,
    places: data,
  });
}
