import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/activities/popular
 *
 * Returns event counts for popular activities (subcategories and categories)
 * within the next 7 days. Used by BrowseByActivity component.
 */
export async function GET() {
  try {
    const client = createServiceClient();

    // Get current date and date 7 days from now
    const today = new Date().toISOString().split("T")[0];
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Query subcategory counts
    const { data: subcategoryCounts, error: subError } = await client
      .from("events")
      .select("subcategory")
      .gte("start_date", today)
      .lte("start_date", weekFromNow)
      .not("subcategory", "is", null);

    if (subError) {
      console.error("Error fetching subcategory counts:", subError);
    }

    // Query category counts for music (live music)
    const { data: categoryCounts, error: catError } = await client
      .from("events")
      .select("category")
      .gte("start_date", today)
      .lte("start_date", weekFromNow)
      .not("category", "is", null);

    if (catError) {
      console.error("Error fetching category counts:", catError);
    }

    // Aggregate counts
    const counts: Record<string, number> = {};

    // Count subcategories
    if (subcategoryCounts) {
      const typedSubcategoryCounts = subcategoryCounts as Array<{ subcategory: string | null }>;
      for (const row of typedSubcategoryCounts) {
        if (row.subcategory) {
          counts[row.subcategory] = (counts[row.subcategory] || 0) + 1;
        }
      }
    }

    // Count categories
    if (categoryCounts) {
      const typedCategoryCounts = categoryCounts as Array<{ category: string | null }>;
      for (const row of typedCategoryCounts) {
        if (row.category) {
          counts[row.category] = (counts[row.category] || 0) + 1;
        }
      }
    }

    return NextResponse.json(
      { counts },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
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
