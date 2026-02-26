import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { logger } from "@/lib/logger";

export const revalidate = 300;

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
      const sortedKey = [...categoryList].sort().join(",");
      const grouped = await getOrSetSharedCacheJson(
        "genres",
        `multi:${sortedKey}`,
        5 * 60 * 1000,
        async () => {
          const supabase = await createClient();
          const { data, error } = await supabase
            .from("taxonomy_definitions")
            .select("id, label, taxonomy_group, is_format, display_order, category_scope")
            .eq("taxonomy_type", "genre")
            .eq("is_active", true)
            .overlaps("category_scope", categoryList)
            .order("display_order", { ascending: true });

          if (error) {
            throw error;
          }

          type TaxRow = { id: string; label: string; taxonomy_group: string; is_format: boolean; display_order: number; category_scope: string[] };
          const rows = (data || []) as TaxRow[];
          const result: Record<string, { genre: string; display_order: number; is_format: boolean }[]> = {};
          for (const row of rows) {
            const group = row.taxonomy_group;
            if (!result[group]) {
              result[group] = [];
            }
            result[group].push({
              genre: row.id,
              display_order: row.display_order,
              is_format: row.is_format,
            });
          }
          return result;
        },
      );

      return NextResponse.json(
        { genres: grouped },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    } catch (error) {
      logger.error("Genre options API error", error, { categories });
      return NextResponse.json({ genres: {} }, { status: 500 });
    }
  }

  // Single-category mode: ?category=music (backwards compat)
  if (!category) {
    return NextResponse.json({ genres: [] });
  }

  try {
    const genres = await getOrSetSharedCacheJson(
      "genres",
      `single:${category}`,
      5 * 60 * 1000,
      async () => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("taxonomy_definitions")
          .select("id, label, is_format, display_order")
          .eq("taxonomy_type", "genre")
          .eq("is_active", true)
          .contains("category_scope", [category])
          .order("display_order", { ascending: true });

        if (error) {
          throw error;
        }

        return (data || []).map((row: { id: string; label: string; is_format: boolean; display_order: number }) => ({
          genre: row.id,
          display_order: row.display_order,
          is_format: row.is_format,
        }));
      },
    );

    return NextResponse.json(
      { genres },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    logger.error("Genre options API error", error, { category });
    return NextResponse.json({ genres: [] }, { status: 500 });
  }
}
