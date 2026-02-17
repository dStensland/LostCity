import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { checkBodySize } from "@/lib/api-utils";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { logger } from "@/lib/logger";

// Valid categories from search-constants.ts
const VALID_CATEGORIES = [
  "music", "film", "comedy", "theater", "art", "sports", "food_drink", "nightlife",
  "community", "fitness", "family", "learning", "dance", "tours", "meetup", "words",
  "religious", "markets", "wellness", "gaming", "outdoors", "other"
];

export async function POST(request: NextRequest) {
  const bodySizeResult = checkBodySize(request);
  if (bodySizeResult) return bodySizeResult;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate genre strings (alphanumeric, hyphens, underscores, dots only)
    const isValidGenre = (g: string): boolean => /^[a-z0-9._-]+$/i.test(g);

    // Validate input
    const selectedCategories = Array.isArray(body.selectedCategories)
      ? body.selectedCategories.filter((c: unknown) => typeof c === "string" && VALID_CATEGORIES.includes(c)).slice(0, 20)
      : [];
    const selectedGenres: Record<string, string[]> | undefined =
      body.selectedGenres && typeof body.selectedGenres === "object" && !Array.isArray(body.selectedGenres)
        ? Object.fromEntries(
            Object.entries(body.selectedGenres as Record<string, unknown>)
              .filter(([k, v]) => VALID_CATEGORIES.includes(k) && Array.isArray(v))
              .map(([k, v]) => [k, (v as string[]).filter((g) => typeof g === "string" && isValidGenre(g)).slice(0, 20)])
              .slice(0, 20)
          )
        : undefined;
    const selectedNeeds = body.selectedNeeds && typeof body.selectedNeeds === "object"
      ? {
          accessibility: Array.isArray(body.selectedNeeds.accessibility)
            ? body.selectedNeeds.accessibility.filter((n: unknown) => typeof n === "string").slice(0, 10)
            : [],
          dietary: Array.isArray(body.selectedNeeds.dietary)
            ? body.selectedNeeds.dietary.filter((n: unknown) => typeof n === "string").slice(0, 10)
            : [],
          family: Array.isArray(body.selectedNeeds.family)
            ? body.selectedNeeds.family.filter((n: unknown) => typeof n === "string").slice(0, 10)
            : [],
        }
      : { accessibility: [], dietary: [], family: [] };

    const attribution = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/onboarding/complete",
      body,
      requireWhenHinted: true,
    });
    if (attribution.response) return attribution.response;
    const portalId = attribution.portalId;

    // Update user preferences with onboarding data
    const prefsData = {
      user_id: user.id,
      onboarding_completed_at: new Date().toISOString(),
      ...(selectedCategories.length > 0 && {
        favorite_categories: selectedCategories,
      }),
      ...(selectedGenres && Object.keys(selectedGenres).length > 0 && {
        favorite_genres: selectedGenres,
      }),
      ...(selectedNeeds.accessibility.length > 0 && {
        needs_accessibility: selectedNeeds.accessibility,
      }),
      ...(selectedNeeds.dietary.length > 0 && {
        needs_dietary: selectedNeeds.dietary,
      }),
      ...(selectedNeeds.family.length > 0 && {
        needs_family: selectedNeeds.family,
      }),
    };

    const { error: prefsError } = await supabase
      .from("user_preferences")
      .upsert(prefsData as never, { onConflict: "user_id" });

    if (prefsError) {
      logger.error("Preferences update error:", prefsError);
    }

    // Build preference signal rows (with portal attribution)
    const preferenceRows = [
      ...selectedCategories.map((category: string) => ({
        user_id: user.id,
        signal_type: "category",
        signal_value: category,
        score: 8,
        interaction_count: 1,
        ...(portalId ? { portal_id: portalId } : {}),
      })),
      // Flatten genre selections into signal rows
      ...Object.entries(selectedGenres || {}).flatMap(([, genres]) =>
        genres.map((genre) => ({
          user_id: user.id,
          signal_type: "genre",
          signal_value: genre,
          score: 8,
          interaction_count: 1,
          ...(portalId ? { portal_id: portalId } : {}),
        }))
      ),
    ];

    if (preferenceRows.length > 0) {
      const { error: preferenceError } = await supabase
        .from("inferred_preferences")
        .upsert(preferenceRows as never, {
          onConflict: "user_id,signal_type,signal_value",
        });

      if (preferenceError) {
        logger.error("Preference signal tracking error:", preferenceError);
      }
    }

    const genreCount = Object.values(selectedGenres || {}).reduce((sum, g) => sum + g.length, 0);

    return Response.json({
      success: true,
      categoryCount: selectedCategories.length,
      genreCount,
    });
  } catch (error) {
    logger.error("Onboarding complete API error:", error);
    return Response.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
