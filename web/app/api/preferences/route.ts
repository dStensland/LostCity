import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function GET() {
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
      // PGRST116 = no rows found
      console.error("Error fetching preferences:", error);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    // Return empty preferences if no row exists
    if (!data) {
      return NextResponse.json({
        favorite_categories: [],
        favorite_neighborhoods: [],
        favorite_vibes: [],
        price_preference: null,
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Preferences API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
