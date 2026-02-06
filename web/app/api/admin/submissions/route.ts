import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin, getUser } from "@/lib/supabase/server";
import { isValidEnum, adminErrorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/admin/submissions - List all submissions with filtering
export async function GET(request: NextRequest) {
  // Apply rate limiting (write tier - admin endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Verify admin or get portal admin permissions
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isGlobalAdmin = await isAdmin();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const portalId = searchParams.get("portal_id");
  const submittedBy = searchParams.get("submitted_by");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");
  const allowedSortFields = ["created_at", "updated_at", "status", "submission_type"];
  const sortByParam = searchParams.get("sort_by") || "created_at";
  const sortBy = allowedSortFields.includes(sortByParam) ? sortByParam : "created_at";
  const sortOrder = searchParams.get("sort_order") === "asc" ? true : false;

  const supabase = await createClient();

  // If not global admin, must be portal admin for a specific portal
  if (!isGlobalAdmin) {
    if (!portalId) {
      return NextResponse.json(
        { error: "Portal admins must specify portal_id" },
        { status: 403 }
      );
    }

    // Check if user is portal admin
    const { data: portalMember } = await supabase
      .from("portal_members")
      .select("role")
      .eq("portal_id", portalId)
      .eq("user_id", user.id)
      .maybeSingle();

    const member = portalMember as { role: string } | null;
    if (!member || !["owner", "admin"].includes(member.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Build query
  let query = supabase
    .from("submissions")
    .select(
      `
      id,
      submission_type,
      status,
      data,
      rejection_reason,
      content_hash,
      potential_duplicate_id,
      potential_duplicate_type,
      duplicate_acknowledged,
      approved_event_id,
      approved_venue_id,
      approved_organization_id,
      image_urls,
      created_at,
      updated_at,
      reviewed_at,
      submitter:profiles!submissions_submitted_by_fkey (
        id, username, display_name, avatar_url,
        submission_count, approved_count, rejected_count, trust_tier
      ),
      reviewer:profiles!submissions_reviewed_by_fkey (
        id, username, display_name
      ),
      portal:portals (
        id, name, slug
      )
    `,
      { count: "exact" }
    )
    .order(sortBy, { ascending: sortOrder })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (status && isValidEnum(status, ["pending", "approved", "rejected", "needs_edit"] as const)) {
    query = query.eq("status", status);
  }

  const normalizedType = type === "organization" ? "producer" : type;
  if (normalizedType && isValidEnum(normalizedType, ["event", "venue", "producer"] as const)) {
    query = query.eq("submission_type", normalizedType);
  }

  if (portalId) {
    query = query.eq("portal_id", portalId);
  }

  if (submittedBy) {
    query = query.eq("submitted_by", submittedBy);
  }

  const { data: queryData, error, count } = await query;

  if (error) {
    return adminErrorResponse(error, "submissions list");
  }

  const data = queryData as Array<{
    id: string;
    submission_type: string;
    status: string;
    data: Record<string, unknown>;
    submitter: { approved_count: number; rejected_count: number } | null;
    [key: string]: unknown;
  }> | null;

  // Get summary counts
  const { data: allSubmissionsData } = await supabase
    .from("submissions")
    .select("status, submission_type");

  const allSubmissions = allSubmissionsData as { status: string; submission_type: string }[] | null;

  const summary = {
    total: allSubmissions?.length || 0,
    byStatus: {
      pending: allSubmissions?.filter((s) => s.status === "pending").length || 0,
      approved: allSubmissions?.filter((s) => s.status === "approved").length || 0,
      rejected: allSubmissions?.filter((s) => s.status === "rejected").length || 0,
      needs_edit: allSubmissions?.filter((s) => s.status === "needs_edit").length || 0,
    },
    byType: {
      event: allSubmissions?.filter((s) => s.submission_type === "event").length || 0,
      venue: allSubmissions?.filter((s) => s.submission_type === "venue").length || 0,
      producer: allSubmissions?.filter((s) => s.submission_type === "producer").length || 0,
    },
  };

  // Calculate trust scores for submitters
  const enrichedData = (data || []).map((submission) => {
    const submitter = submission.submitter as {
      approved_count: number;
      rejected_count: number;
      trust_tier: string | null;
    } | null;
    let trustScore = null;
    let isTrusted = false;
    let isEligible = false;

    if (submitter) {
      const total = submitter.approved_count + submitter.rejected_count;
      if (total > 0) {
        trustScore = submitter.approved_count / total;
        isEligible = submitter.approved_count >= 5 && trustScore >= 0.9;
      }
      isTrusted = submitter.trust_tier === "trusted_submitter";
    }

    return {
      ...submission,
      submitter_trust_score: trustScore,
      submitter_is_trusted: isTrusted,
      submitter_is_trust_eligible: isEligible,
      submitter_trust_tier: submitter?.trust_tier || "standard",
    };
  });

  return NextResponse.json({
    submissions: enrichedData,
    summary,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
}
