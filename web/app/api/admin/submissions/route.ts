import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin, getUser } from "@/lib/supabase/server";
import { isValidEnum, adminErrorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// GET /api/admin/submissions - List all submissions with filtering
export async function GET(request: NextRequest) {
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
  const sortBy = searchParams.get("sort_by") || "created_at";
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
      .single();

    if (!portalMember || !["owner", "admin"].includes(portalMember.role)) {
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
      approved_producer_id,
      image_urls,
      created_at,
      updated_at,
      reviewed_at,
      submitter:profiles!submissions_submitted_by_fkey (
        id, username, display_name, avatar_url,
        submission_count, approved_count, rejected_count
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

  if (type && isValidEnum(type, ["event", "venue", "producer"] as const)) {
    query = query.eq("submission_type", type);
  }

  if (portalId) {
    query = query.eq("portal_id", portalId);
  }

  if (submittedBy) {
    query = query.eq("submitted_by", submittedBy);
  }

  const { data, error, count } = await query;

  if (error) {
    return adminErrorResponse(error, "submissions list");
  }

  // Get summary counts
  const { data: allSubmissions } = await supabase
    .from("submissions")
    .select("status, submission_type");

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
    } | null;
    let trustScore = null;
    let isTrusted = false;

    if (submitter) {
      const total = submitter.approved_count + submitter.rejected_count;
      if (total > 0) {
        trustScore = submitter.approved_count / total;
        isTrusted = submitter.approved_count >= 5 && trustScore >= 0.9;
      }
    }

    return {
      ...submission,
      submitter_trust_score: trustScore,
      submitter_is_trusted: isTrusted,
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
