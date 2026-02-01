import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, isAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  isValidEnum,
  isValidString,
  isValidUUID,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type {
  SubmissionType,
  EventSubmissionData,
  VenueSubmissionData,
  ProducerSubmissionData,
} from "@/lib/types";
import { autoApproveVenue } from "@/lib/venue-auto-approve";
import crypto from "crypto";
import { logger } from "@/lib/logger";

// Rate limits for submissions (per day) - admins bypass these
const SUBMISSION_LIMITS = {
  event: 50,
  venue: 25,
  producer: 15,
};

// GET /api/submissions - Get user's submission history
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();

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
      duplicate_acknowledged,
      approved_event_id,
      approved_venue_id,
      approved_organization_id,
      image_urls,
      created_at,
      updated_at,
      reviewed_at,
      reviewer:profiles!submissions_reviewed_by_fkey (
        id, username, display_name
      ),
      portal:portals (
        id, name, slug
      )
    `,
      { count: "exact" }
    )
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && isValidEnum(status, ["pending", "approved", "rejected", "needs_edit"] as const)) {
    query = query.eq("status", status);
  }

  if (type && isValidEnum(type, ["event", "venue", "producer"] as const)) {
    query = query.eq("submission_type", type);
  }

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(error, "submissions list");
  }

  // Get counts by status
  const { data: statusCountsData } = await supabase
    .from("submissions")
    .select("status")
    .eq("submitted_by", user.id);

  const statusCounts = statusCountsData as { status: string }[] | null;

  const counts = {
    total: statusCounts?.length || 0,
    pending: statusCounts?.filter((s) => s.status === "pending").length || 0,
    approved: statusCounts?.filter((s) => s.status === "approved").length || 0,
    rejected: statusCounts?.filter((s) => s.status === "rejected").length || 0,
    needs_edit: statusCounts?.filter((s) => s.status === "needs_edit").length || 0,
  };

  return NextResponse.json({
    submissions: data || [],
    counts,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
}

// POST /api/submissions - Create a new submission
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Apply rate limit
  const identifier = user.id;
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write, identifier);
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const {
    submission_type,
    data,
    portal_id,
    duplicate_acknowledged,
    image_urls,
  } = body as {
    submission_type: SubmissionType;
    data: EventSubmissionData | VenueSubmissionData | ProducerSubmissionData;
    portal_id?: string;
    duplicate_acknowledged?: boolean;
    image_urls?: string[];
  };

  // Validate submission type
  if (!isValidEnum(submission_type, ["event", "venue", "producer"] as const)) {
    return NextResponse.json(
      { error: "Invalid submission_type. Must be event, venue, or producer" },
      { status: 400 }
    );
  }

  // Validate data object exists
  if (!data || typeof data !== "object") {
    return NextResponse.json(
      { error: "Missing or invalid data object" },
      { status: 400 }
    );
  }

  // Validate portal_id if provided
  if (portal_id && !isValidUUID(portal_id)) {
    return NextResponse.json({ error: "Invalid portal_id" }, { status: 400 });
  }

  const supabase = await createClient();

  // Check if user is admin (admins bypass rate limits)
  const userIsAdmin = await isAdmin();

  // Check daily rate limit for this submission type (skip for admins)
  if (!userIsAdmin) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("submitted_by", user.id)
      .eq("submission_type", submission_type)
      .gte("created_at", today.toISOString());

    const dailyLimit = SUBMISSION_LIMITS[submission_type];
    if ((todayCount || 0) >= dailyLimit) {
      return NextResponse.json(
        {
          error: `Daily limit reached. You can submit ${dailyLimit} ${submission_type}s per day.`,
          limit: dailyLimit,
          used: todayCount,
        },
        { status: 429 }
      );
    }
  }

  // Validate type-specific required fields
  const validationError = validateSubmissionData(submission_type, data);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Check portal permissions if portal_id provided
  if (portal_id) {
    const { data: portalData } = await supabase
      .from("portals")
      .select("id, settings")
      .eq("id", portal_id)
      .maybeSingle();

    const portal = portalData as { id: string; settings: Record<string, unknown> | null } | null;

    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Check if submissions are enabled for this portal
    const settings = portal.settings as { submissions?: { enabled?: boolean; who_can_submit?: string } } | null;
    if (settings?.submissions?.enabled === false) {
      return NextResponse.json(
        { error: "Submissions are not enabled for this portal" },
        { status: 403 }
      );
    }
  }

  // Generate content hash for duplicate detection
  const contentHash = generateContentHash(submission_type, data);

  // Check for potential duplicates
  let potentialDuplicate: { id: number; type: string } | null = null;
  if (submission_type === "event") {
    const eventData = data as EventSubmissionData;
    potentialDuplicate = await findEventDuplicate(supabase, eventData, contentHash);
  } else if (submission_type === "venue") {
    const venueData = data as VenueSubmissionData;
    potentialDuplicate = await findVenueDuplicate(supabase, venueData);
  }

  // If duplicate found and not acknowledged, return warning
  if (potentialDuplicate && !duplicate_acknowledged) {
    return NextResponse.json(
      {
        warning: "Potential duplicate detected",
        duplicate: potentialDuplicate,
        message: "Set duplicate_acknowledged to true to submit anyway",
      },
      { status: 409 }
    );
  }

  // Auto-approve venue with Foursquare Place ID
  if (submission_type === "venue") {
    const venueData = data as VenueSubmissionData;
    const placeId = venueData.foursquare_id || venueData.google_place_id;
    if (placeId) {
      logger.info("Attempting auto-approval for venue", { placeId, userId: user.id, component: "submissions" });

      const autoApproveResult = await autoApproveVenue(
        placeId,
        user.id,
        portal_id
      );

      if (autoApproveResult.success && autoApproveResult.venue) {
        // Auto-approval succeeded, return success immediately
        logger.info("Venue auto-approved", { venueName: autoApproveResult.venue.name, venueId: autoApproveResult.venue.id, userId: user.id, component: "submissions" });

        // Fetch the submission that was created by autoApproveVenue
        const { data: approvedSubmission } = await supabase
          .from("submissions")
          .select("id, status, created_at")
          .eq("approved_venue_id", autoApproveResult.venue.id)
          .eq("submitted_by", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return NextResponse.json(
          {
            success: true,
            submission: approvedSubmission || {
              id: null,
              status: "approved",
            },
            venue: autoApproveResult.venue,
            autoApproved: true,
            message: "Venue automatically approved via Foursquare Place validation.",
          },
          { status: 201 }
        );
      } else {
        // Auto-approval failed, log the error and fall through to normal submission
        logger.warn("Auto-approval failed, falling back to pending submission", { error: autoApproveResult.error, placeId, userId: user.id, component: "submissions" });
      }
    }
  }

  // Get client IP for rate limiting tracking
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null;

  // Create submission
  const { data: submission, error } = await supabase
    .from("submissions")
    .insert({
      submission_type,
      submitted_by: user.id,
      portal_id: portal_id || null,
      data,
      content_hash: contentHash,
      potential_duplicate_id: potentialDuplicate?.id || null,
      potential_duplicate_type: potentialDuplicate?.type || null,
      duplicate_acknowledged: duplicate_acknowledged || false,
      image_urls: image_urls || null,
      ip_address: ip,
    } as never)
    .select()
    .maybeSingle();

  if (error) {
    logger.error("Submission creation error", error, { userId: user.id, submissionType: submission_type, component: "submissions" });
    return errorResponse(error, "submission creation");
  }

  return NextResponse.json(
    {
      submission,
      message: "Submission created successfully. It will be reviewed soon.",
    },
    { status: 201 }
  );
}

// Validate submission data based on type
function validateSubmissionData(
  type: SubmissionType,
  data: EventSubmissionData | VenueSubmissionData | ProducerSubmissionData
): string | null {
  if (type === "event") {
    const eventData = data as EventSubmissionData;
    if (!isValidString(eventData.title, 3, 200)) {
      return "Event title is required (3-200 characters)";
    }
    if (!eventData.start_date) {
      return "Event start_date is required";
    }
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventData.start_date)) {
      return "Invalid start_date format. Use YYYY-MM-DD";
    }
    // Check date is not in the past
    const startDate = new Date(eventData.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      return "Event start_date cannot be in the past";
    }
    // Must have either venue_id or venue data
    if (!eventData.venue_id && !eventData.venue?.name) {
      return "Event must have a venue_id or venue name";
    }
  } else if (type === "venue") {
    const venueData = data as VenueSubmissionData;
    if (!isValidString(venueData.name, 2, 200)) {
      return "Venue name is required (2-200 characters)";
    }
  } else if (type === "organization" || type === "producer") {
    const producerData = data as ProducerSubmissionData;
    if (!isValidString(producerData.name, 2, 200)) {
      return "Organization name is required (2-200 characters)";
    }
  }

  return null;
}

// Generate content hash for duplicate detection
function generateContentHash(
  type: SubmissionType,
  data: EventSubmissionData | VenueSubmissionData | ProducerSubmissionData
): string {
  let hashInput: string;

  if (type === "event") {
    const eventData = data as EventSubmissionData;
    // Hash: title + date + venue_id or venue_name
    const venuePart = eventData.venue_id?.toString() || eventData.venue?.name || "";
    hashInput = `${eventData.title?.toLowerCase().trim()}|${eventData.start_date}|${venuePart.toLowerCase().trim()}`;
  } else if (type === "venue") {
    const venueData = data as VenueSubmissionData;
    // Hash: name + address (normalized)
    hashInput = `${venueData.name?.toLowerCase().trim()}|${venueData.address?.toLowerCase().trim() || ""}`;
  } else {
    const producerData = data as ProducerSubmissionData;
    // Hash: name (normalized)
    hashInput = producerData.name?.toLowerCase().trim() || "";
  }

  return crypto.createHash("md5").update(hashInput).digest("hex");
}

// Find potential event duplicate
async function findEventDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: EventSubmissionData,
  contentHash: string
): Promise<{ id: number; type: string } | null> {
  // Check by content hash first
  const { data: hashMatchData } = await supabase
    .from("events")
    .select("id, title")
    .eq("content_hash", contentHash)
    .limit(1)
    .maybeSingle();

  const hashMatch = hashMatchData as { id: number; title: string } | null;
  if (hashMatch) {
    return { id: hashMatch.id, type: "event" };
  }

  // Check by title similarity on same date
  if (data.venue_id) {
    const { data: titleMatchData } = await supabase
      .from("events")
      .select("id, title")
      .eq("start_date", data.start_date)
      .eq("venue_id", data.venue_id)
      .ilike("title", `%${data.title?.substring(0, 20)}%`)
      .limit(1)
      .maybeSingle();

    const titleMatch = titleMatchData as { id: number; title: string } | null;
    if (titleMatch) {
      return { id: titleMatch.id, type: "event" };
    }
  }

  return null;
}

// Find potential venue duplicate
async function findVenueDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: VenueSubmissionData
): Promise<{ id: number; type: string } | null> {
  // Check by exact name match
  const { data: nameMatchData } = await supabase
    .from("venues")
    .select("id, name")
    .ilike("name", data.name)
    .limit(1)
    .maybeSingle();

  const nameMatch = nameMatchData as { id: number; name: string } | null;
  if (nameMatch) {
    return { id: nameMatch.id, type: "venue" };
  }

  // Check aliases
  if (data.name) {
    const { data: aliasMatchData } = await supabase
      .from("venues")
      .select("id, name")
      .contains("aliases", [data.name])
      .limit(1)
      .maybeSingle();

    const aliasMatch = aliasMatchData as { id: number; name: string } | null;
    if (aliasMatch) {
      return { id: aliasMatch.id, type: "venue" };
    }
  }

  return null;
}
