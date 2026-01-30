import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/activities/popular
 *
 * Returns event counts for popular activities (subcategories and categories)
 * within a configurable time period. Used by BrowseByActivity component.
 *
 * Query params:
 *   - date_filter: "today" | "week" | "month" (default: "week")
 */
export async function GET(request: NextRequest) {
  try {
    // Use the same supabase client as search to ensure counts match what users see
    // (respects RLS policies)
    const client = supabase;
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get("date_filter") || "week";

    // Get current date and calculate end date based on filter
    const today = new Date().toISOString().split("T")[0];
    let endDate: string;
    let cacheSeconds: number;

    switch (dateFilter) {
      case "today":
        endDate = today;
        cacheSeconds = 60; // Shorter cache for today (changes frequently)
        break;
      case "month":
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        cacheSeconds = 300;
        break;
      case "week":
      default:
        endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        cacheSeconds = 300;
        break;
    }

    // Query subcategory counts
    const { data: subcategoryCounts, error: subError } = await client
      .from("events")
      .select("subcategory")
      .gte("start_date", today)
      .lte("start_date", endDate)
      .not("subcategory", "is", null);

    if (subError) {
      console.error("Error fetching subcategory counts:", subError);
    }

    // Query category counts
    const { data: categoryCounts, error: catError } = await client
      .from("events")
      .select("category, subcategory")
      .gte("start_date", today)
      .lte("start_date", endDate)
      .not("category", "is", null);

    if (catError) {
      console.error("Error fetching category counts:", catError);
    }

    // Aggregate counts by category
    const counts: Record<string, number> = {};
    // Aggregate counts by subcategory (e.g., "music.live": 30)
    const subcategory_counts: Record<string, number> = {};

    // Count subcategories for the subcategory_counts object
    if (subcategoryCounts) {
      const typedSubcategoryCounts = subcategoryCounts as Array<{ subcategory: string | null }>;
      for (const row of typedSubcategoryCounts) {
        if (row.subcategory) {
          subcategory_counts[row.subcategory] = (subcategory_counts[row.subcategory] || 0) + 1;
        }
      }
    }

    // Count categories (this counts all events per category, not just those with subcategories)
    if (categoryCounts) {
      const typedCategoryCounts = categoryCounts as Array<{ category: string | null; subcategory: string | null }>;
      for (const row of typedCategoryCounts) {
        if (row.category) {
          counts[row.category] = (counts[row.category] || 0) + 1;
        }
      }
    }

    return NextResponse.json(
      { counts, subcategory_counts, date_filter: dateFilter },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
        },
      }
    );
  } catch (error) {
    console.error("Error in popular activities API:", error);
    return NextResponse.json(
      { counts: {}, error: "Failed to fetch activity counts" },
      { status: 500 }
    );
  }
}
