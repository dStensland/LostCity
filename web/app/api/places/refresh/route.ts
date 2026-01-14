import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ITP_NEIGHBORHOODS, getNeighborhoodsByTier } from "@/config/neighborhoods";
import { PLACE_CATEGORIES, getCategoryById } from "@/config/categories";
import {
  searchNearbyPlaces,
  mapGooglePlaceToDb,
  calculateGoogleScore,
} from "@/lib/google-places";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// This endpoint should be protected in production (add auth check)
export async function POST(req: NextRequest) {
  // Check for API key or admin auth
  const authHeader = req.headers.get("authorization");
  const expectedKey = process.env.PLACES_REFRESH_API_KEY;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tier = body.tier as 1 | 2 | 3 | undefined;
  const categoryId = body.category as string | undefined;
  const neighborhoodId = body.neighborhood as string | undefined;
  const dryRun = body.dryRun === true;

  // Filter neighborhoods
  let neighborhoods = tier
    ? getNeighborhoodsByTier(tier)
    : neighborhoodId
      ? ITP_NEIGHBORHOODS.filter((n) => n.id === neighborhoodId)
      : ITP_NEIGHBORHOODS;

  // Filter categories
  let categories = categoryId
    ? PLACE_CATEGORIES.filter((c) => c.id === categoryId)
    : PLACE_CATEGORIES;

  let processed = 0;
  let errors = 0;
  const results: Array<{
    neighborhood: string;
    category: string;
    count: number;
    error?: string;
  }> = [];

  for (const hood of neighborhoods) {
    for (const cat of categories) {
      try {
        console.log(`Fetching ${cat.id} in ${hood.name}...`);

        const places = await searchNearbyPlaces({
          lat: hood.lat,
          lng: hood.lng,
          radius: hood.radius,
          types: cat.googleTypes,
        });

        let categoryProcessed = 0;

        for (const place of places) {
          const dbPlace = mapGooglePlaceToDb(place, hood.id, cat.id);

          // Calculate Google score
          dbPlace.google_score = calculateGoogleScore(
            dbPlace.rating,
            dbPlace.rating_count
          );

          // Initial final_score = google_score (no user data yet)
          dbPlace.final_score = dbPlace.google_score;

          if (!dryRun) {
            const { error } = await supabase.from("places").upsert(dbPlace, {
              onConflict: "google_place_id",
              ignoreDuplicates: false,
            });

            if (error) {
              console.error(`Error upserting ${dbPlace.name}:`, error);
              errors++;
            } else {
              processed++;
              categoryProcessed++;
            }
          } else {
            processed++;
            categoryProcessed++;
          }
        }

        results.push({
          neighborhood: hood.name,
          category: cat.name,
          count: categoryProcessed,
        });

        // Rate limit: max 1 request per second to avoid hitting Google API limits
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error(`Error fetching ${cat.id} in ${hood.name}:`, err);
        errors++;
        results.push({
          neighborhood: hood.name,
          category: cat.name,
          count: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    processed,
    errors,
    results,
  });
}
