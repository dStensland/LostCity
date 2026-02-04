import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

interface OnboardingCompleteRequest {
  selectedCategories: string[];
  selectedSubcategories: string[];
  selectedNeighborhoods: string[];
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
    const { selectedCategories, selectedSubcategories, selectedNeighborhoods } = body;

    // Update user preferences with onboarding data
    const prefsData = {
      user_id: user.id,
      onboarding_completed_at: new Date().toISOString(),
      // Set categories if selected
      ...(selectedCategories.length > 0 && {
        favorite_categories: selectedCategories,
      }),
      // Set neighborhoods if selected
      ...(selectedNeighborhoods.length > 0 && {
        favorite_neighborhoods: selectedNeighborhoods,
      }),
    };

    const { error: prefsError } = await supabase
      .from("user_preferences")
      .upsert(prefsData as never, { onConflict: "user_id" });

    if (prefsError) {
      logger.error("Preferences update error:", prefsError);
      // Don't fail the whole request - continue
    }

    // Batch all preference signals into a single upsert
    const preferenceRows = [
      ...selectedCategories.map((category) => ({
        user_id: user.id,
        signal_type: "category",
        signal_value: category,
        score: 8, // Strong signal from explicit selection
        interaction_count: 1,
      })),
      ...selectedSubcategories.map((subcategory) => ({
        user_id: user.id,
        signal_type: "subcategory",
        signal_value: subcategory,
        score: 9, // Even stronger signal from specific selection
        interaction_count: 1,
      })),
      ...selectedNeighborhoods.map((neighborhood) => ({
        user_id: user.id,
        signal_type: "neighborhood",
        signal_value: neighborhood,
        score: 8, // Strong signal from explicit selection
        interaction_count: 1,
      })),
    ];

    // Single batched upsert for all preferences
    if (preferenceRows.length > 0) {
      const { error: preferenceError } = await supabase
        .from("inferred_preferences")
        .upsert(preferenceRows as never, {
          onConflict: "user_id,signal_type,signal_value",
        });

      if (preferenceError) {
        logger.error("Preference signal tracking error:", preferenceError);
        // Don't fail the whole request - continue
      }
    }

    return Response.json({
      success: true,
      categoryCount: selectedCategories.length,
      subcategoryCount: selectedSubcategories.length,
      neighborhoodCount: selectedNeighborhoods.length,
    });
  } catch (error) {
    logger.error("Onboarding complete API error:", error);
    return Response.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
