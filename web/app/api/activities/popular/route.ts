import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { format, startOfDay, addDays } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";

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
    // Use per-request client to respect RLS policies
    const client = await createClient();
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get("date_filter") || "week";
    const portalExclusive = searchParams.get("portal_exclusive") === "true";
    const portalContext = await resolvePortalQueryContext(client, searchParams);
    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { counts: {}, error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }
    const sourceAccess = portalContext.portalId
      ? await getPortalSourceAccess(portalContext.portalId)
      : null;

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

    // Query activity dimensions with same filters as search
    let activityQuery = client
      .from("events")
      .select("category, genres")
      .gte("start_date", today)
      .lte("start_date", endDate)
      .is("canonical_event_id", null)
      .or(timeFilter)
      .not("category", "is", null)
      .or("is_sensitive.eq.false,is_sensitive.is.null");

    activityQuery = applyFederatedPortalScopeToQuery(activityQuery, {
      portalId: portalContext.portalId,
      portalExclusive,
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess?.sourceIds || [],
      sourceColumn: "source_id",
    });

    const { data: activityRows, error: activityError } = await activityQuery;

    if (activityError) {
      logger.error("Error fetching activity counts:", activityError);
    }

    // Aggregate counts by category
    const counts: Record<string, number> = {};
    // Aggregate counts by genre (e.g., "music.rock": 30)
    const subcategory_counts: Record<string, number> = {};

    // Count categories and subactivities from genres[].
    // Keys are normalized to "category.genre" format for backwards compat.
    if (activityRows) {
      const typedActivityRows = activityRows as Array<{
        category: string | null;
        genres: string[] | null;
      }>;
      for (const row of typedActivityRows) {
        if (row.category) {
          counts[row.category] = (counts[row.category] || 0) + 1;

          const rowGenres = Array.isArray(row.genres)
            ? row.genres.filter((genre): genre is string => typeof genre === "string" && genre.length > 0)
            : [];

          for (const genre of rowGenres) {
            const subactivityKey = `${row.category}.${genre}`;
            subcategory_counts[subactivityKey] = (subcategory_counts[subactivityKey] || 0) + 1;
          }
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
    logger.error("Error in popular activities API:", error);
    return NextResponse.json(
      { counts: {}, error: "Failed to fetch activity counts" },
      { status: 500 }
    );
  }
}
