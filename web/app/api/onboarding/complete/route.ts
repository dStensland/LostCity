import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface OnboardingCompleteRequest {
  selectedCategories: string[];
  selectedSubcategories: string[];
  selectedNeighborhoods: string[];
}

export async function POST(request: Request) {
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write);
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
      console.error("Preferences update error:", prefsError);
      // Don't fail the whole request - continue
    }

    // Track category signals for future recommendations
    if (selectedCategories.length > 0) {
      for (const category of selectedCategories) {
        try {
          await supabase.from("inferred_preferences").upsert(
            {
              user_id: user.id,
              signal_type: "category",
              signal_value: category,
              score: 8, // Strong signal from explicit selection
              interaction_count: 1,
            } as never,
            { onConflict: "user_id,signal_type,signal_value" }
          );
        } catch (err) {
          console.error("Category signal tracking error:", err);
        }
      }
    }

    // Track subcategory signals
    if (selectedSubcategories.length > 0) {
      for (const subcategory of selectedSubcategories) {
        try {
          await supabase.from("inferred_preferences").upsert(
            {
              user_id: user.id,
              signal_type: "subcategory",
              signal_value: subcategory,
              score: 9, // Even stronger signal from specific selection
              interaction_count: 1,
            } as never,
            { onConflict: "user_id,signal_type,signal_value" }
          );
        } catch (err) {
          console.error("Subcategory signal tracking error:", err);
        }
      }
    }

    // Track neighborhood signals
    if (selectedNeighborhoods.length > 0) {
      for (const neighborhood of selectedNeighborhoods) {
        try {
          await supabase.from("inferred_preferences").upsert(
            {
              user_id: user.id,
              signal_type: "neighborhood",
              signal_value: neighborhood,
              score: 8, // Strong signal from explicit selection
              interaction_count: 1,
            } as never,
            { onConflict: "user_id,signal_type,signal_value" }
          );
        } catch (err) {
          console.error("Neighborhood signal tracking error:", err);
        }
      }
    }

    return Response.json({
      success: true,
      categoryCount: selectedCategories.length,
      subcategoryCount: selectedSubcategories.length,
      neighborhoodCount: selectedNeighborhoods.length,
    });
  } catch (error) {
    console.error("Onboarding complete API error:", error);
    return Response.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
