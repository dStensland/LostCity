import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString, parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/school-calendar
// Returns school calendar events (no-school days, breaks, holidays, etc.)
// for Atlanta-area school systems.
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  const systemParam = searchParams.get("system"); // comma-separated: aps,dekalb,cobb,gwinnett
  const yearParam = searchParams.get("year");
  const upcomingParam = searchParams.get("upcoming");
  const upcomingOnly = upcomingParam !== "false"; // default true
  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 20, 100);

  const VALID_SYSTEMS = new Set(["aps", "dekalb", "cobb", "gwinnett"]);

  // Parse systems filter
  let systems: string[] | null = null;
  if (systemParam && isValidString(systemParam, 1, 200)) {
    systems = systemParam
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => VALID_SYSTEMS.has(s));
    if (systems.length === 0) systems = null;
  }

  // Determine school year — default to current based on calendar year
  // Atlanta school year runs Aug–May, so school year "2025-26" covers Aug 2025 – May 2026
  let schoolYear = yearParam && isValidString(yearParam, 4, 10) ? yearParam : null;
  if (!schoolYear) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed
    // After July, we're in the next school year
    if (month >= 8) {
      schoolYear = `${year}-${String(year + 1).slice(-2)}`;
    } else {
      schoolYear = `${year - 1}-${String(year).slice(-2)}`;
    }
  }

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    let calendarQuery = supabase
      .from("school_calendar_events")
      .select(
        "id, school_system, event_type, name, start_date, end_date, school_year"
      )
      .eq("school_year", schoolYear)
      .order("start_date", { ascending: true })
      .limit(limit);

    if (upcomingOnly) {
      calendarQuery = calendarQuery.gte("start_date", today);
    }

    if (systems && systems.length > 0) {
      calendarQuery = calendarQuery.in("school_system", systems);
    }

    const { data, error } = await calendarQuery;

    if (error) {
      return errorResponse(error, "GET /api/school-calendar");
    }

    return NextResponse.json(
      {
        events: data ?? [],
        total: (data ?? []).length,
        school_year: schoolYear,
        systems: systems ?? ["aps", "dekalb", "cobb", "gwinnett"],
      },
      {
        headers: {
          // School calendars rarely change — cache generously
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/school-calendar");
  }
}
