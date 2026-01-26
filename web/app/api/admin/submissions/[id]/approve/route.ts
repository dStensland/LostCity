import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidUUID, adminErrorResponse } from "@/lib/api-utils";
import type { EventSubmissionData, VenueSubmissionData, ProducerSubmissionData } from "@/lib/types";

type Props = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/submissions/[id]/approve - Approve a submission
export async function POST(request: NextRequest, { params }: Props) {
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
  const { data: submission, error: fetchError } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // Check permissions
  if (!isGlobalAdmin && submission.portal_id) {
    const { data: portalMember } = await supabase
      .from("portal_members")
      .select("role")
      .eq("portal_id", submission.portal_id)
      .eq("user_id", user.id)
      .single();

    if (!portalMember || !["owner", "admin"].includes(portalMember.role)) {
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
        submission.data as EventSubmissionData,
        submission.submitted_by,
        submission.id
      );
    } else if (submission.submission_type === "venue") {
      approvedEntityId = await createVenueFromSubmission(
        serviceClient,
        submission.data as VenueSubmissionData,
        submission.submitted_by,
        submission.id
      );
    } else if (submission.submission_type === "producer") {
      approvedEntityId = await createProducerFromSubmission(
        serviceClient,
        submission.data as ProducerSubmissionData,
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
  } else if (submission.submission_type === "producer") {
    updateData.approved_producer_id = approvedEntityId;
  }

  const { data: updated, error: updateError } = await supabase
    .from("submissions")
    .update(updateData as never)
    .eq("id", id)
    .select()
    .single();

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
  const { data: source } = await supabase
    .from("sources")
    .select("id")
    .eq("slug", "user-submissions")
    .single();

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

  // Handle inline producer creation if needed
  let producerId = data.producer_id;
  if (!producerId && data.producer) {
    producerId = await createProducerFromSubmission(
      supabase,
      data.producer,
      submittedBy,
      submissionId
    );
  }

  // Create the event
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      source_id: source.id,
      venue_id: venueId || null,
      producer_id: producerId || null,
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
    .single();

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
    .single();

  // If exists, add a unique suffix
  const finalSlug = existing
    ? `${slug}-${Date.now().toString(36)}`
    : slug;

  const { data: venue, error } = await supabase
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
    .single();

  if (error || !venue) {
    throw error || new Error("Failed to create venue");
  }

  return venue.id;
}

// Create producer from submission data
async function createProducerFromSubmission(
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
    .from("event_producers")
    .select("id")
    .eq("id", baseSlug)
    .single();

  // If exists, add a unique suffix
  const finalId = existing
    ? `${baseSlug}-${Date.now().toString(36)}`
    : baseSlug;

  const { data: producer, error } = await supabase
    .from("event_producers")
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
      is_verified: false, // User-submitted producers start unverified
      submitted_by: submittedBy,
      from_submission: submissionId,
    } as never)
    .select("id")
    .single();

  if (error || !producer) {
    throw error || new Error("Failed to create producer");
  }

  return producer.id;
}
