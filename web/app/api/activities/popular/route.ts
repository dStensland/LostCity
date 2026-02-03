import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { format, startOfDay, addDays } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

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
  // Rate limit
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    // Use the same supabase client as search to ensure counts match what users see
    // (respects RLS policies)
    const client = supabase;
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get("date_filter") || "week";

    // Get current date/time and calculate end date based on filter
    // Use date-fns format to get local date (not UTC from toISOString)
    const now = new Date();
    const today = format(startOfDay(now), "yyyy-MM-dd");
    const currentTime = now.toTimeString().split(" ")[0]; // HH:MM:SS format
    let endDate: string;
    let cacheSeconds: number;

    switch (dateFilter) {
      case "today":
        endDate = today;
        cacheSeconds = 60; // Shorter cache for today (changes frequently)
        break;
      case "month":
        endDate = format(addDays(startOfDay(now), 30), "yyyy-MM-dd");
        cacheSeconds = 300;
        break;
      case "week":
      default:
        endDate = format(addDays(startOfDay(now), 7), "yyyy-MM-dd");
        cacheSeconds = 300;
        break;
    }

    // Build time-based filter to hide events that have already started/ended today
    // This matches the logic in search.ts to ensure counts match what users see
    const timeFilter = `start_date.gt.${today},end_time.gte.${currentTime},and(end_time.is.null,start_time.gte.${currentTime}),is_all_day.eq.true`;

    // Query subcategory counts with same filters as search:
    // - Time filter (hide past events)
    // - Dedup filter (canonical_event_id is null)
    const { data: subcategoryCounts, error: subError } = await client
      .from("events")
      .select("subcategory")
      .gte("start_date", today)
      .lte("start_date", endDate)
      .is("canonical_event_id", null)
      .or(timeFilter)
      .not("subcategory", "is", null);

    if (subError) {
      console.error("Error fetching subcategory counts:", subError);
    }

    // Query category counts with same filters
    const { data: categoryCounts, error: catError } = await client
      .from("events")
      .select("category, subcategory")
      .gte("start_date", today)
      .lte("start_date", endDate)
      .is("canonical_event_id", null)
      .or(timeFilter)
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
