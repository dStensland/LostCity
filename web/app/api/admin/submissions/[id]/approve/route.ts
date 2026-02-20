import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidUUID, adminErrorResponse, checkBodySize } from "@/lib/api-utils";
import type { EventSubmissionData, VenueSubmissionData, ProducerSubmissionData, Submission } from "@/lib/types";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  createEventFromSubmission,
  createVenueFromSubmission,
  createOrganizationFromSubmission,
  queueCrawlerSourceEvaluationFromSubmission,
} from "@/lib/submissions/approval";

type Props = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/submissions/[id]/approve - Approve a submission
export async function POST(request: NextRequest, { params }: Props) {
  // Check body size
  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  // Apply rate limiting (write tier - admin endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
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
    .select("id, portal_id, submission_type, status, data, submitted_by, created_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !submissionData) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const submission = submissionData as Submission;

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

  // Can only approve pending or needs_edit submissions
  if (!["pending", "needs_edit"].includes(submission.status)) {
    return NextResponse.json(
      { error: `Cannot approve submission with status: ${submission.status}` },
      { status: 400 }
    );
  }

  // Parse request body for any overrides
  const body = await request.json().catch(() => ({}));
  const { admin_notes } = body as { admin_notes?: string };

  // Use service client to bypass RLS for creating entities
  const serviceClient = createServiceClient();

  // Create the entity based on submission type
  let approvedEntityId: number | string | null = null;

  try {
    if (submission.submission_type === "event") {
      approvedEntityId = await createEventFromSubmission(
        serviceClient,
        submission.data as unknown as EventSubmissionData,
        submission.submitted_by,
        submission.id
      );
    } else if (submission.submission_type === "venue") {
      const venueData = submission.data as unknown as VenueSubmissionData;
      approvedEntityId = await createVenueFromSubmission(
        serviceClient,
        venueData,
        submission.submitted_by,
        submission.id
      );
      try {
        await queueCrawlerSourceEvaluationFromSubmission(serviceClient, {
          name: venueData.name,
          website: venueData.website,
          sourceType: "venue",
          portalId: submission.portal_id,
        });
      } catch (queueError) {
        logger.warn("Failed to queue venue source for crawler evaluation", {
          submission_id: submission.id,
          error: queueError,
        });
      }
    } else if (submission.submission_type === "organization" || submission.submission_type === "producer") {
      const orgData = submission.data as unknown as ProducerSubmissionData;
      approvedEntityId = await createOrganizationFromSubmission(
        serviceClient,
        orgData,
        submission.submitted_by,
        submission.id
      );
      try {
        await queueCrawlerSourceEvaluationFromSubmission(serviceClient, {
          name: orgData.name,
          website: orgData.website,
          sourceType: "organization",
          portalId: submission.portal_id,
        });
      } catch (queueError) {
        logger.warn("Failed to queue organization source for crawler evaluation", {
          submission_id: submission.id,
          error: queueError,
        });
      }
    }
  } catch (error) {
    logger.error("Failed to create entity:", error);
    return adminErrorResponse(error, "entity creation");
  }

  // Update submission status
  const updateData: Record<string, unknown> = {
    status: "approved",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    admin_notes: admin_notes || null,
  };

  if (submission.submission_type === "event") {
    updateData.approved_event_id = approvedEntityId;
  } else if (submission.submission_type === "venue") {
    updateData.approved_venue_id = approvedEntityId;
  } else if (submission.submission_type === "organization" || submission.submission_type === "producer") {
    updateData.approved_organization_id = approvedEntityId;
  }

  const { data: updated, error: updateError } = await supabase
    .from("submissions")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    return adminErrorResponse(updateError, "submission approval");
  }

  return NextResponse.json({
    submission: updated,
    approved_entity_id: approvedEntityId,
    message: "Submission approved successfully",
  });
}
