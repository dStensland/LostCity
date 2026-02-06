import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin, getUser } from "@/lib/supabase/server";
import { isValidEnum, adminErrorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const CLAIM_STATUSES = ["pending", "approved", "rejected", "needs_info"] as const;

export const dynamic = "force-dynamic";

// GET /api/admin/claims - List all claim requests
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();

  let query = supabase
    .from("entity_claim_requests")
    .select(
      `
      id,
      status,
      venue_id,
      organization_id,
      verification_method,
      verification_domain,
      verification_token,
      notes,
      rejection_reason,
      created_at,
      updated_at,
      reviewed_at,
      requested_by:profiles!entity_claim_requests_requested_by_fkey (
        id, username, display_name, avatar_url
      ),
      reviewer:profiles!entity_claim_requests_reviewed_by_fkey (
        id, username, display_name
      ),
      venue:venues(id, name, slug),
      organization:organizations(id, name, slug)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && isValidEnum(status, CLAIM_STATUSES)) {
    query = query.eq("status", status);
  }

  if (type === "venue") {
    query = query.not("venue_id", "is", null);
  }

  if (type === "organization") {
    query = query.not("organization_id", "is", null);
  }

  const { data, error, count } = await query;

  if (error) {
    return adminErrorResponse(error, "claims list");
  }

  const { data: allClaimsData } = await supabase
    .from("entity_claim_requests")
    .select("status");

  const allClaims = allClaimsData as { status: string }[] | null;

  const summary = {
    total: allClaims?.length || 0,
    byStatus: {
      pending: allClaims?.filter((c) => c.status === "pending").length || 0,
      approved: allClaims?.filter((c) => c.status === "approved").length || 0,
      rejected: allClaims?.filter((c) => c.status === "rejected").length || 0,
      needs_info: allClaims?.filter((c) => c.status === "needs_info").length || 0,
    },
  };

  return NextResponse.json({
    claims: data || [],
    summary,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
}
