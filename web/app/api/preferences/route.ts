import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorResponse, checkBodySize } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

// Valid categories from search-constants.ts
const VALID_CATEGORIES = [
  "music",
  "film",
  "comedy",
  "theater",
  "art",
  "sports",
  "food_drink",
  "nightlife",
  "community",
  "fitness",
  "family",
  "learning",
  "dance",
  "tours",
  "meetup",
  "words",
  "religious",
  "markets",
  "wellness",
  "gaming",
  "outdoors",
  "other",
];

export async function POST(request: NextRequest) {
  const bodySizeResult = checkBodySize(request);
  if (bodySizeResult) return bodySizeResult;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate and sanitize all array fields (max 30 items, strings only)
    const sanitizeArray = (val: unknown, max = 30): string[] =>
      Array.isArray(val)
        ? val.filter((v): v is string => typeof v === "string").slice(0, max)
        : [];

    // Validate genre strings (alphanumeric, hyphens, underscores, dots only)
    const isValidGenre = (g: string): boolean => /^[a-z0-9._-]+$/i.test(g);

    const favorite_categories = sanitizeArray(body.favorite_categories).filter(
      (c) => VALID_CATEGORIES.includes(c),
    );
    const favorite_neighborhoods = sanitizeArray(body.favorite_neighborhoods);
    const favorite_vibes = sanitizeArray(body.favorite_vibes);
    const needs_accessibility = sanitizeArray(body.needs_accessibility);
    const needs_dietary = sanitizeArray(body.needs_dietary);
    const needs_family = sanitizeArray(body.needs_family);
    const price_preference =
      typeof body.price_preference === "string" ? body.price_preference : "any";
    const favorite_genres =
      body.favorite_genres &&
      typeof body.favorite_genres === "object" &&
      !Array.isArray(body.favorite_genres)
        ? Object.fromEntries(
            Object.entries(body.favorite_genres as Record<string, unknown>)
              .filter(
                ([k, v]) => VALID_CATEGORIES.includes(k) && Array.isArray(v),
              )
              .map(([k, v]) => [
                k,
                (v as string[])
                  .filter((g) => typeof g === "string" && isValidGenre(g))
                  .slice(0, 30),
              ]),
          )
        : undefined;
    const hide_adult_content =
      typeof body.hide_adult_content === "boolean"
        ? body.hide_adult_content
        : undefined;
    const cross_portal_recommendations =
      typeof body.cross_portal_recommendations === "boolean"
        ? body.cross_portal_recommendations
        : true;

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("user_preferences").upsert(
      {
        user_id: user.id,
        favorite_categories: favorite_categories || [],
        favorite_neighborhoods: favorite_neighborhoods || [],
        favorite_vibes: favorite_vibes || [],
        price_preference: price_preference || "any",
        cross_portal_recommendations,
        ...(hide_adult_content !== undefined && { hide_adult_content }),
        ...(favorite_genres !== undefined && { favorite_genres }),
        ...(needs_accessibility !== undefined && { needs_accessibility }),
        ...(needs_dietary !== undefined && { needs_dietary }),
        ...(needs_family !== undefined && { needs_family }),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      logger.error("Error saving preferences", error);
      return NextResponse.json(
        { error: "Failed to save preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, "POST /api/preferences");
  }
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      logger.error("Error fetching preferences", error);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          favorite_categories: [],
          favorite_neighborhoods: [],
          favorite_vibes: [],
          favorite_genres: null,
          price_preference: null,
          needs_accessibility: [],
          needs_dietary: [],
          needs_family: [],
          hide_adult_content: false,
          cross_portal_recommendations: true,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
          },
        },
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return errorResponse(err, "GET /api/preferences");
  }
}
