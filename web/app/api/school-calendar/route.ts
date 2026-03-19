import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString, parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// ISO date pattern: YYYY-MM-DD
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/school-calendar
// Returns school calendar events (no-school days, breaks, holidays, etc.)
// for Atlanta-area school systems.
//
// Query params:
//   system  — comma-separated: aps,dekalb,cobb,gwinnett (or a single value)
//   from    — ISO date (YYYY-MM-DD): lower bound on start_date
//   to      — ISO date (YYYY-MM-DD): upper bound on start_date
//   year    — school year string (e.g. "2025-26"); inferred from current date when omitted
//   upcoming — "false" to include past events (default: only future events when no from/to)
//   limit   — max results, capped at 200 (default 50)
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  const systemParam = searchParams.get("system"); // comma-separated: aps,dekalb,cobb,gwinnett
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const yearParam = searchParams.get("year");
  const upcomingParam = searchParams.get("upcoming");
  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 50, 200);

  const VALID_SYSTEMS = new Set(["aps", "dekalb", "cobb", "gwinnett"]);

  // Parse systems filter (supports single value or comma-separated list)
  let systems: string[] | null = null;
  if (systemParam && isValidString(systemParam, 1, 200)) {
    systems = systemParam
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => VALID_SYSTEMS.has(s));
    if (systems.length === 0) systems = null;
  }

  // Validate ISO date params
  const fromDate = fromParam && ISO_DATE_RE.test(fromParam) ? fromParam : null;
  const toDate = toParam && ISO_DATE_RE.test(toParam) ? toParam : null;

  // Determine school year — default to current based on calendar year
  // Atlanta school year runs Aug–May, so "2025-26" covers Aug 2025 – May 2026
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

    if (fromDate) {
      // Explicit date range: events whose start_date falls within [from, to]
      calendarQuery = calendarQuery.gte("start_date", fromDate);
    } else if (upcomingParam !== "false") {
      // Default: only future events when no explicit from date
      calendarQuery = calendarQuery.gte("start_date", today);
    }

    if (toDate) {
      calendarQuery = calendarQuery.lte("start_date", toDate);
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
          // School calendars rarely change — cache aggressively
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/school-calendar");
  }
}
