import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidUUID, adminErrorResponse } from "@/lib/api-utils";
import type { EventSubmissionData, VenueSubmissionData, ProducerSubmissionData, Submission } from "@/lib/types";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type Props = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/submissions/[id]/approve - Approve a submission
export async function POST(request: NextRequest, { params }: Props) {
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
      approvedEntityId = await createVenueFromSubmission(
        serviceClient,
        submission.data as unknown as VenueSubmissionData,
        submission.submitted_by,
        submission.id
      );
    } else if (submission.submission_type === "organization") {
      approvedEntityId = await createOrganizationFromSubmission(
        serviceClient,
        submission.data as unknown as ProducerSubmissionData,
        submission.submitted_by,
        submission.id
      );
    }
  } catch (error) {
    console.error("Failed to create entity:", error);
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
  } else if (submission.submission_type === "organization") {
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

// Create event from submission data
async function createEventFromSubmission(
  supabase: ReturnType<typeof createServiceClient>,
  data: EventSubmissionData,
  submittedBy: string,
  submissionId: string
): Promise<number> {
  // Get user submissions source ID
  const { data: sourceData } = await supabase
    .from("sources")
    .select("id")
    .eq("slug", "user-submissions")
    .maybeSingle();

  const source = sourceData as { id: number } | null;
  if (!source) {
    throw new Error("User submissions source not found");
  }

  // Handle inline venue creation if needed
  let venueId = data.venue_id;
  if (!venueId && data.venue) {
    venueId = await createVenueFromSubmission(
      supabase,
      data.venue,
      submittedBy,
      submissionId
    );
  }

  // Handle inline organization creation if needed
  let organizationId = data.organization_id;
  if (!organizationId && data.organization) {
    organizationId = await createOrganizationFromSubmission(
      supabase,
      data.organization,
      submittedBy,
      submissionId
    );
  }

  // Create the event
  const { data: eventData, error } = await supabase
    .from("events")
    .insert({
      source_id: source.id,
      venue_id: venueId || null,
      organization_id: organizationId || null,
      title: data.title,
      description: data.description || null,
      start_date: data.start_date,
      start_time: data.start_time || null,
      end_date: data.end_date || null,
      end_time: data.end_time || null,
      is_all_day: data.is_all_day || false,
      category: data.category || null,
      subcategory: data.subcategory || null,
      tags: data.tags || null,
      price_min: data.price_min || null,
      price_max: data.price_max || null,
      price_note: data.price_note || null,
      is_free: data.is_free || false,
      source_url: data.source_url || `https://lostcity.io/submit/${submissionId}`,
      ticket_url: data.ticket_url || null,
      image_url: data.image_url || null,
      submitted_by: submittedBy,
      from_submission: submissionId,
    } as never)
    .select("id")
    .maybeSingle();

  const event = eventData as { id: number } | null;
  if (error || !event) {
    throw error || new Error("Failed to create event");
  }

  return event.id;
}

// Create venue from submission data
async function createVenueFromSubmission(
  supabase: ReturnType<typeof createServiceClient>,
  data: VenueSubmissionData,
  submittedBy: string,
  submissionId: string
): Promise<number> {
  // Generate slug from name
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if slug exists
  const { data: existing } = await supabase
    .from("venues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  // If exists, add a unique suffix
  const finalSlug = existing
    ? `${slug}-${Date.now().toString(36)}`
    : slug;

  const { data: venueData, error } = await supabase
    .from("venues")
    .insert({
      name: data.name,
      slug: finalSlug,
      address: data.address || null,
      neighborhood: data.neighborhood || null,
      city: data.city || "Atlanta",
      state: data.state || "GA",
      zip: data.zip || null,
      website: data.website || null,
      venue_type: data.venue_type || null,
      submitted_by: submittedBy,
      from_submission: submissionId,
    } as never)
    .select("id")
    .maybeSingle();

  const venue = venueData as { id: number } | null;
  if (error || !venue) {
    throw error || new Error("Failed to create venue");
  }

  return venue.id;
}

// Create organization from submission data
async function createOrganizationFromSubmission(
  supabase: ReturnType<typeof createServiceClient>,
  data: ProducerSubmissionData,
  submittedBy: string,
  submissionId: string
): Promise<string> {
  // Generate ID and slug from name
  const baseSlug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if ID/slug exists
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", baseSlug)
    .maybeSingle();

  // If exists, add a unique suffix
  const finalId = existing
    ? `${baseSlug}-${Date.now().toString(36)}`
    : baseSlug;

  const { data: organizationData, error } = await supabase
    .from("organizations")
    .insert({
      id: finalId,
      name: data.name,
      slug: finalId,
      org_type: data.org_type || "community_group",
      website: data.website || null,
      email: data.email || null,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      neighborhood: data.neighborhood || null,
      description: data.description || null,
      categories: data.categories || null,
      is_verified: false, // User-submitted organizations start unverified
      submitted_by: submittedBy,
      from_submission: submissionId,
    } as never)
    .select("id")
    .maybeSingle();

  const organization = organizationData as { id: string } | null;
  if (error || !organization) {
    throw error || new Error("Failed to create organization");
  }

  return organization.id;
}
