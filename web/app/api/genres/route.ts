import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const categories = searchParams.get("categories");

  // Multi-category mode: ?categories=music,comedy,film
  if (categories) {
    const categoryList = categories.split(",").map((c) => c.trim()).filter(Boolean);
    if (categoryList.length === 0) {
      return NextResponse.json({ genres: {} });
    }

    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("genre_options")
        .select("genre, display_order, is_format, category")
        .in("category", categoryList)
        .order("display_order", { ascending: true });

      if (error) {
        logger.error("Failed to fetch genre options", error, { categories });
        return NextResponse.json({ genres: {} }, { status: 500 });
      }

      // Group by category
      type GenreRow = { genre: string; display_order: number; is_format: boolean; category: string };
      const rows = (data || []) as GenreRow[];
      const grouped: Record<string, { genre: string; display_order: number; is_format: boolean }[]> = {};
      for (const row of rows) {
        if (!grouped[row.category]) {
          grouped[row.category] = [];
        }
        grouped[row.category].push(row);
      }

      return NextResponse.json(
        { genres: grouped },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    } catch (error) {
      logger.error("Genre options API error", error);
      return NextResponse.json({ genres: {} }, { status: 500 });
    }
  }

  // Single-category mode: ?category=music (backwards compat)
  if (!category) {
    return NextResponse.json({ genres: [] });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("genre_options")
      .select("genre, display_order, is_format")
      .eq("category", category)
      .order("display_order", { ascending: true });

    if (error) {
      logger.error("Failed to fetch genre options", error, { category });
      return NextResponse.json({ genres: [] }, { status: 500 });
    }

    return NextResponse.json(
      { genres: data || [] },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    logger.error("Genre options API error", error);
    return NextResponse.json({ genres: [] }, { status: 500 });
  }
}
