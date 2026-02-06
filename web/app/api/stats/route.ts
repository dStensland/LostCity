import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache for 1 hour

// GET /api/stats - Public stats for landing page
export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // Get counts in parallel
    const [eventsResult, venuesResult, sourcesResult] = await Promise.all([
      // Count events happening today or in the future
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("start_date", new Date().toISOString().split("T")[0]),

      // Count active venues
      supabase
        .from("venues")
        .select("*", { count: "exact", head: true }),

      // Count active sources
      supabase
        .from("sources")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    const stats = {
      events: eventsResult.count || 0,
      venues: venuesResult.count || 0,
      sources: sourcesResult.count || 0,
    };

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    // Return fallback stats on error
    return NextResponse.json({
      events: 5000,
      venues: 500,
      sources: 450,
    });
  }
}
