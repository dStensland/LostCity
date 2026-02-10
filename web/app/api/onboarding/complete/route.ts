import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

interface OnboardingCompleteRequest {
  selectedCategories: string[];
  selectedGenres?: Record<string, string[]>;
}

export async function POST(request: Request) {
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

    const body: OnboardingCompleteRequest = await request.json();
    const { selectedCategories, selectedGenres } = body;

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
    };

    const { error: prefsError } = await supabase
      .from("user_preferences")
      .upsert(prefsData as never, { onConflict: "user_id" });

    if (prefsError) {
      logger.error("Preferences update error:", prefsError);
    }

    // Build preference signal rows
    const preferenceRows = [
      ...selectedCategories.map((category) => ({
        user_id: user.id,
        signal_type: "category",
        signal_value: category,
        score: 8,
        interaction_count: 1,
      })),
      // Flatten genre selections into signal rows
      ...Object.entries(selectedGenres || {}).flatMap(([, genres]) =>
        genres.map((genre) => ({
          user_id: user.id,
          signal_type: "genre",
          signal_value: genre,
          score: 8,
          interaction_count: 1,
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
