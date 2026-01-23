import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

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
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows found, which is fine
      console.error("Error fetching preferences:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    // Get current values for this preference type
    const currentValues = (currentPrefs?.[columnName as keyof typeof currentPrefs] as string[] | null) || [];

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
      // Update existing preferences
      const { error: updateError } = await supabase
        .from("user_preferences")
        .update({ [columnName]: updatedValues })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating preferences:", updateError);
        return NextResponse.json(
          { error: "Failed to update preferences" },
          { status: 500 }
        );
      }
    } else {
      // Insert new preferences row
      const { error: insertError } = await supabase
        .from("user_preferences")
        .insert({
          user_id: user.id,
          [columnName]: updatedValues,
        });

      if (insertError) {
        console.error("Error inserting preferences:", insertError);
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
    console.error("Preferences API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
