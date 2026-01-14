import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const params = req.nextUrl.searchParams;

  const lat = parseFloat(params.get("lat") || "0");
  const lng = parseFloat(params.get("lng") || "0");
  const radius = parseInt(params.get("radius") || "2000");
  const category = params.get("category");
  const minScore = parseInt(params.get("minScore") || "40");

  // Validate coordinates
  if (lat === 0 || lng === 0) {
    return NextResponse.json(
      { error: "Valid lat and lng parameters are required" },
      { status: 400 }
    );
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
    console.error("Error fetching nearby places:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    places: data,
    center: { lat, lng },
    radius,
  });
}
