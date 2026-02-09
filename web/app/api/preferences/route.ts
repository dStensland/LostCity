import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;
  try {
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
    } = body;

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          favorite_categories: favorite_categories || [],
          favorite_neighborhoods: favorite_neighborhoods || [],
          favorite_vibes: favorite_vibes || [],
          price_preference: price_preference || "any",
        },
        { onConflict: "user_id" }
      );

    if (error) {
      logger.error("Error saving preferences", error);
      return NextResponse.json(
        { error: "Failed to save preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, "POST /api/preferences");
  }
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
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
      // PGRST116 = no rows found
      logger.error("Error fetching preferences", error);
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
      }, {
        headers: {
          "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
        },
      });
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
