import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// GET /api/personalization/preferences - Get user preferences
export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

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
    // PGRST116 is "not found" which is fine
    return errorResponse(error, "preferences");
  }

  // Return default preferences if none exist
  return NextResponse.json(
    data || {
      favorite_categories: [],
      favorite_neighborhoods: [],
      favorite_vibes: [],
      price_preference: null,
    }
  );
}

// PATCH /api/personalization/preferences - Update user preferences
export async function PATCH(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    favorite_categories,
    favorite_neighborhoods,
    favorite_vibes,
    price_preference,
  } = body as {
    favorite_categories?: string[];
    favorite_neighborhoods?: string[];
    favorite_vibes?: string[];
    price_preference?: string | null;
  };

  const supabase = await createClient();

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (favorite_categories !== undefined) updates.favorite_categories = favorite_categories;
  if (favorite_neighborhoods !== undefined) updates.favorite_neighborhoods = favorite_neighborhoods;
  if (favorite_vibes !== undefined) updates.favorite_vibes = favorite_vibes;
  if (price_preference !== undefined) updates.price_preference = price_preference;

  // Check if preferences exist
  const { data: existing } = await supabase
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from("user_preferences")
      .update(updates as never)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      return errorResponse(error, "preferences");
    }

    return NextResponse.json(data);
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("user_preferences")
      .insert({
        user_id: user.id,
        ...updates,
      } as never)
      .select()
      .maybeSingle();

    if (error) {
      return errorResponse(error, "preferences");
    }

    return NextResponse.json(data);
  }
}
