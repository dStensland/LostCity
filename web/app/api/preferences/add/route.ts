import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type PreferenceType = "category" | "neighborhood" | "vibe";

const VALID_PREFERENCE_TYPES = ["category", "neighborhood", "vibe"] as const;

// Map preference types to database column names
const PREFERENCE_COLUMNS: Record<PreferenceType, string> = {
  category: "favorite_categories",
  neighborhood: "favorite_neighborhoods",
  vibe: "favorite_vibes",
};

export async function POST(request: Request) {
  try {
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, value } = body as { type: string; value: string };

    // Validate input
    if (!type || !value) {
      return NextResponse.json(
        { error: "Missing required fields: type and value" },
        { status: 400 }
      );
    }

    if (!VALID_PREFERENCE_TYPES.includes(type as PreferenceType)) {
      return NextResponse.json(
        { error: `Invalid preference type. Must be one of: ${VALID_PREFERENCE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const preferenceType = type as PreferenceType;
    const columnName = PREFERENCE_COLUMNS[preferenceType];

    const supabase = await createClient();

    // Get current preferences
    const { data: currentPrefs, error: fetchError } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows found, which is fine
      logger.error("Error fetching preferences", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    // Get current values for this preference type
    const prefsRecord = currentPrefs as Record<string, unknown> | null;
    const currentValues = (prefsRecord?.[columnName] as string[] | null) ?? [];

    // Check if value already exists
    if (currentValues.includes(value)) {
      return NextResponse.json({
        success: true,
        message: "Preference already exists",
        preferences: currentValues,
      });
    }

    // Add the new value
    const updatedValues = [...currentValues, value];

    if (currentPrefs) {
      // Update existing preferences - use raw SQL to avoid type issues
      const updateData = { [columnName]: updatedValues } as Record<string, string[]>;
      const { error: updateError } = await supabase
        .from("user_preferences")
        .update(updateData as never)
        .eq("user_id", user.id);

      if (updateError) {
        logger.error("Error updating preferences", updateError);
        return NextResponse.json(
          { error: "Failed to update preferences" },
          { status: 500 }
        );
      }
    } else {
      // Insert new preferences row
      const insertData = {
        user_id: user.id,
        [columnName]: updatedValues,
      } as Record<string, unknown>;
      const { error: insertError } = await supabase
        .from("user_preferences")
        .insert(insertData as never);

      if (insertError) {
        logger.error("Error inserting preferences", insertError);
        return NextResponse.json(
          { error: "Failed to create preferences" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added ${value} to ${preferenceType} preferences`,
      preferences: updatedValues,
    });
  } catch (err) {
    return errorResponse(err, "POST /api/preferences/add");
  }
}
