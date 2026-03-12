import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const tag = request.nextUrl.searchParams.get("tag");
  if (!tag || tag.length > 50) {
    return NextResponse.json({ count: 0 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .filter("tags", "cs", `{"${tag}"}`)
    .eq("is_active", true)
    .gte("start_date", today);

  return NextResponse.json(
    { count: count ?? 0 },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
