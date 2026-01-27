import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse, isValidUUID } from "@/lib/api-utils";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/submissions/[id] - Get submission detail
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid submission ID" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: submissionData, error } = await supabase
    .from("submissions")
    .select(
      `
      id,
      submission_type,
      submitted_by,
      portal_id,
      status,
      reviewed_by,
      reviewed_at,
      rejection_reason,
      data,
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
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !submissionData) {
    if (error?.code === "PGRST116") {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const submission = submissionData as {
    submitted_by: string;
    portal_id: string | null;
    status: string;
    potential_duplicate_id: number | null;
    potential_duplicate_type: string | null;
    approved_event_id: number | null;
    approved_venue_id: number | null;
    approved_producer_id: string | null;
    [key: string]: unknown;
  };

  // Check if user can view this submission
  // User can view their own submissions, admins can view all
  const { data: profileData } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as { is_admin: boolean } | null;

  if (submission.submitted_by !== user.id && !profile?.is_admin) {
    // Check if user is portal admin
    if (submission.portal_id) {
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
    } else {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // If there's a potential duplicate, fetch its details
  let duplicateDetails = null;
  if (submission.potential_duplicate_id && submission.potential_duplicate_type) {
    if (submission.potential_duplicate_type === "event") {
      const { data: event } = await supabase
        .from("events")
        .select("id, title, start_date, venue:venues(name)")
        .eq("id", submission.potential_duplicate_id)
        .maybeSingle();
      duplicateDetails = event;
    } else if (submission.potential_duplicate_type === "venue") {
      const { data: venue } = await supabase
        .from("venues")
        .select("id, name, address, neighborhood")
        .eq("id", submission.potential_duplicate_id)
        .maybeSingle();
      duplicateDetails = venue;
    }
  }

  // If approved, fetch the approved entity details
  let approvedEntity: { type: string; data: unknown } | null = null;
  if (submission.status === "approved") {
    if (submission.approved_event_id) {
      const { data: event } = await supabase
        .from("events")
        .select("id, title, start_date, source_url")
        .eq("id", submission.approved_event_id)
        .maybeSingle();
      approvedEntity = { type: "event", data: event };
    } else if (submission.approved_venue_id) {
      const { data: venue } = await supabase
        .from("venues")
        .select("id, name, slug")
        .eq("id", submission.approved_venue_id)
        .maybeSingle();
      approvedEntity = { type: "venue", data: venue };
    } else if (submission.approved_producer_id) {
      const { data: producer } = await supabase
        .from("event_producers")
        .select("id, name, slug")
        .eq("id", submission.approved_producer_id)
        .maybeSingle();
      approvedEntity = { type: "producer", data: producer };
    }
  }

  return NextResponse.json({
    submission,
    duplicateDetails,
    approvedEntity,
  });
}

// PUT /api/submissions/[id] - Update a pending submission
export async function PUT(request: NextRequest, { params }: Props) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid submission ID" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Check if submission exists and belongs to user
  const { data: existingData, error: fetchError } = await supabase
    .from("submissions")
    .select("id, submitted_by, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingData) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const existing = existingData as { id: string; submitted_by: string; status: string };

  // Only owner can update
  if (existing.submitted_by !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Can only update pending or needs_edit submissions
  if (!["pending", "needs_edit"].includes(existing.status)) {
    return NextResponse.json(
      { error: "Cannot update submission with status: " + existing.status },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { data, image_urls, duplicate_acknowledged } = body;

  // Build update object
  const updates: Record<string, unknown> = {};

  if (data !== undefined) {
    updates.data = data;
    updates.status = "pending"; // Reset to pending if data changed
  }

  if (image_urls !== undefined) {
    updates.image_urls = image_urls;
  }

  if (duplicate_acknowledged !== undefined) {
    updates.duplicate_acknowledged = duplicate_acknowledged;
  }

  const { data: updated, error } = await supabase
    .from("submissions")
    .update(updates as never)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(error, "submission update");
  }

  return NextResponse.json({ submission: updated });
}

// DELETE /api/submissions/[id] - Cancel/delete a pending submission
export async function DELETE(request: NextRequest, { params }: Props) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid submission ID" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Check if submission exists and belongs to user
  const { data: existingDeleteData, error: fetchError } = await supabase
    .from("submissions")
    .select("id, submitted_by, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingDeleteData) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const existingDelete = existingDeleteData as { id: string; submitted_by: string; status: string };

  // Only owner can delete
  if (existingDelete.submitted_by !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Can only delete pending submissions
  if (existingDelete.status !== "pending") {
    return NextResponse.json(
      { error: "Can only delete pending submissions" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("submissions").delete().eq("id", id);

  if (error) {
    return errorResponse(error, "submission deletion");
  }

  return NextResponse.json({ success: true, message: "Submission deleted" });
}
