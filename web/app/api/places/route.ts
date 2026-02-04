import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  // Rate limit: read endpoint
  const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  const supabase = getSupabase();
  const params = req.nextUrl.searchParams;

  const category = params.get("category");
  const neighborhood = params.get("neighborhood");
  const minScore = parseIntParam(params.get("minScore"), 0) ?? 0;
  const is24Hours = params.get("24hr") === "true";
  const editorPicks = params.get("editorPicks") === "true";
  const search = params.get("search");
  const limit = Math.min(50, parseIntParam(params.get("limit"), 20) ?? 20);
  const offset = parseIntParam(params.get("offset"), 0) ?? 0;

  let query = supabase
    .from("places")
    .select("*", { count: "exact" })
    .eq("hidden", false)
    .gte("final_score", minScore)
    .order("final_score", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq("category_id", category);
  }

  if (neighborhood) {
    query = query.eq("neighborhood_id", neighborhood);
  }

  if (is24Hours) {
    query = query.eq("is_24_hours", true);
  }

  if (editorPicks) {
    query = query.eq("editor_pick", true);
  }

  // Full-text search
  if (search) {
    query = query.textSearch("fts", search, { type: "websearch" });
  }

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(error, "places:GET");
  }

  return NextResponse.json(
    {
      places: data,
      total: count,
      limit,
      offset,
    },
    {
      headers: {
        // Places data is relatively stable - cache for 60 seconds
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
