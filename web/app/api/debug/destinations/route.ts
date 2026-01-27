import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const destTypes = [
    "restaurant", "food_hall", "cooking_school",
    "bar", "brewery", "distillery", "winery", "rooftop", "sports_bar",
    "club", "coffee_shop", "games", "eatertainment", "arcade", "karaoke"
  ];

  // Count by spot_type
  const { data: byType, error: typeError } = await supabase
    .from("venues")
    .select("spot_type")
    .in("spot_type", destTypes);

  const typeCounts: Record<string, number> = {};
  if (byType) {
    for (const v of byType) {
      typeCounts[v.spot_type || "null"] = (typeCounts[v.spot_type || "null"] || 0) + 1;
    }
  }

  // Count active ones
  const { data: activeByType, error: activeError } = await supabase
    .from("venues")
    .select("spot_type")
    .in("spot_type", destTypes)
    .eq("active", true);

  const activeTypeCounts: Record<string, number> = {};
  if (activeByType) {
    for (const v of activeByType) {
      activeTypeCounts[v.spot_type || "null"] = (activeTypeCounts[v.spot_type || "null"] || 0) + 1;
    }
  }

  // Sample venues
  const { data: samples } = await supabase
    .from("venues")
    .select("id, name, spot_type, neighborhood, active, lat, lng")
    .in("spot_type", destTypes)
    .limit(20);

  return Response.json({
    totalByType: typeCounts,
    activeByType: activeTypeCounts,
    errors: { typeError, activeError },
    samples,
  });
}
