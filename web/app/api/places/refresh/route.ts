import { NextRequest, NextResponse } from "next/server";
import { ITP_NEIGHBORHOODS, getNeighborhoodsByTier } from "@/config/neighborhoods";
import { PLACE_CATEGORIES } from "@/config/categories";
import {
  searchNearbyPlaces,
  mapGooglePlaceToDb,
  calculateGoogleScore,
} from "@/lib/google-places";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { checkBodySize, checkParsedBodySize } from "@/lib/api-utils";

function getSupabase() {
  return createServiceClient();
}

// This endpoint requires PLACES_REFRESH_API_KEY to be set
export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.standard);
  if (rateLimitResult) return rateLimitResult;

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = getSupabase();
  } catch (error) {
    logger.error("Places refresh unavailable: missing service key", error);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Limit payload size (endpoint only expects a small filter object)
  const bodySizeError = checkBodySize(req, 10 * 1024);
  if (bodySizeError) return bodySizeError;

  // Check for API key - must be configured and must match
  const authHeader = req.headers.get("authorization");
  const expectedKey = process.env.PLACES_REFRESH_API_KEY;

  // SECURITY: Fail if key not configured
  if (!expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extract token from Bearer header
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";

  // Use timing-safe comparison
  if (!token || token.length !== expectedKey.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const isValid = timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedKey)
    );

    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const parsedBodySizeError = checkParsedBodySize(body, 10 * 1024);
  if (parsedBodySizeError) return parsedBodySizeError;

  const tier = body.tier as 1 | 2 | 3 | undefined;
  const categoryId = body.category as string | undefined;
  const neighborhoodId = body.neighborhood as string | undefined;
  const dryRun = body.dryRun === true;

  if (tier !== undefined && ![1, 2, 3].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  if (categoryId !== undefined && !PLACE_CATEGORIES.some((c) => c.id === categoryId)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (neighborhoodId !== undefined && !ITP_NEIGHBORHOODS.some((n) => n.id === neighborhoodId)) {
    return NextResponse.json({ error: "Invalid neighborhood" }, { status: 400 });
  }

  // Filter neighborhoods
  const neighborhoods = tier
    ? getNeighborhoodsByTier(tier)
    : neighborhoodId
      ? ITP_NEIGHBORHOODS.filter((n) => n.id === neighborhoodId)
      : ITP_NEIGHBORHOODS;

  // Filter categories
  const categories = categoryId
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
            const { error } = await supabase.from("places").upsert(dbPlace as never, {
              onConflict: "google_place_id",
              ignoreDuplicates: false,
            });

            if (error) {
              logger.error(`Error upserting ${dbPlace.name}:`, error);
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
        logger.error(`Error fetching ${cat.id} in ${hood.name}:`, err);
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
