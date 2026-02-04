import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin, getUser } from "@/lib/supabase/server";
import { isValidUUID, isValidString, adminErrorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type Props = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/submissions/[id]/reject - Reject a submission
export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write);
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid submission ID" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isGlobalAdmin = await isAdmin();
  const supabase = await createClient();

  // Get submission
  const { data: submissionData, error: fetchError } = await supabase
    .from("submissions")
    .select("id, status, portal_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !submissionData) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const submission = submissionData as { id: string; status: string; portal_id: string | null };

  // Check permissions
  if (!isGlobalAdmin && submission.portal_id) {
    const { data: portalMember } = await supabase
      .from("portal_members")
      .select("role")
      .eq("portal_id", submission.portal_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const member = portalMember as { role: string } | null;
    if (!member || !["owner", "admin"].includes(member.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  } else if (!isGlobalAdmin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Can only reject pending or needs_edit submissions
  if (!["pending", "needs_edit"].includes(submission.status)) {
    return NextResponse.json(
      { error: `Cannot reject submission with status: ${submission.status}` },
      { status: 400 }
    );
  }

  // Parse request body
  const body = await request.json();
  const { rejection_reason, admin_notes } = body as {
    rejection_reason?: string;
    admin_notes?: string;
  };

  // Rejection reason is required
  if (!rejection_reason || !isValidString(rejection_reason, 10, 1000)) {
    return NextResponse.json(
      { error: "rejection_reason is required (10-1000 characters)" },
      { status: 400 }
    );
  }

  // Update submission status
  const { data: updated, error: updateError } = await supabase
    .from("submissions")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason,
      admin_notes: admin_notes || null,
    } as never)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    return adminErrorResponse(updateError, "submission rejection");
  }

  return NextResponse.json({
    submission: updated,
    message: "Submission rejected",
  });
}
