import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = request.nextUrl;
  const tag = searchParams.get("tag");
  if (!tag || tag.length > 50) {
    return NextResponse.json({ count: 0 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Resolve portal scope when a portal slug is provided
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  const portalId = portalContext.portalId || undefined;
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;
  const sourceIds = sourceAccess?.sourceIds ?? [];

  let query = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .filter("tags", "cs", `{"${tag}"}`)
    .eq("is_active", true)
    .gte("start_date", today);

  query = applyFederatedPortalScopeToQuery(query, {
    portalId,
    sourceIds,
    sourceColumn: "source_id",
  });

  const { count } = await query;

  return NextResponse.json(
    { count: count ?? 0 },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
