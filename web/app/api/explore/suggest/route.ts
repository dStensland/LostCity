import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidString, isValidUUID, sanitizeString } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";

/**
 * POST /api/explore/suggest
 * Suggest a venue for a track
 * Body: { trackId: string, venueId?: number, venueName: string, reason: string }
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  // Check body size
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { trackId, venueId, venueName, reason } = body;

    // Validate trackId
    if (!isValidUUID(trackId)) {
      return validationError("Invalid trackId. Must be a valid UUID");
    }

    // Validate venueId if provided
    if (venueId !== undefined && venueId !== null) {
      if (typeof venueId !== "number" || !Number.isInteger(venueId) || venueId <= 0) {
        return validationError("Invalid venueId. Must be a positive integer or null");
      }
    }

    // Validate venueName
    if (!isValidString(venueName, 1, 200)) {
      return validationError("Invalid venueName. Must be between 1 and 200 characters");
    }

    // Validate reason
    if (!isValidString(reason, 10, 500)) {
      return validationError("Invalid reason. Must be between 10 and 500 characters");
    }

    // Sanitize inputs
    const sanitizedVenueName = sanitizeString(venueName);
    const sanitizedReason = sanitizeString(reason);

    // Ensure profile exists
    await ensureUserProfile(user, serviceClient);

    // Verify track exists and is active
    const { data: track } = await serviceClient
      .from("explore_tracks")
      .select("id, is_active")
      .eq("id", trackId)
      .maybeSingle();

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    if (!track.is_active) {
      return NextResponse.json({ error: "Track is not active" }, { status: 400 });
    }

    // If venueId is provided, verify it exists
    if (venueId) {
      const { data: venue } = await serviceClient
        .from("venues")
        .select("id, name")
        .eq("id", venueId)
        .maybeSingle();

      if (!venue) {
        return NextResponse.json({ error: "Venue not found" }, { status: 404 });
      }

      // Check if venue is already on this track
      const { data: existingTrackVenue } = await serviceClient
        .from("explore_track_venues")
        .select("id, status")
        .eq("track_id", trackId)
        .eq("venue_id", venueId)
        .maybeSingle();

      if (existingTrackVenue) {
        if (existingTrackVenue.status === "approved") {
          return NextResponse.json(
            { error: "Venue is already on this track" },
            { status: 409 }
          );
        }
        if (existingTrackVenue.status === "pending") {
          return NextResponse.json(
            { error: "This venue has already been suggested for this track" },
            { status: 409 }
          );
        }
      }
    }

    // Create suggestion (stored as pending track_venue with editorial_blurb = reason)
    const insertData: {
      track_id: string;
      venue_id: number | null;
      added_by: string;
      status: string;
      editorial_blurb: string;
    } = {
      track_id: trackId,
      venue_id: venueId || null,
      added_by: user.id,
      status: "pending",
      editorial_blurb: `SUGGESTION: ${sanitizedVenueName} - ${sanitizedReason}`,
    };

    const { data: suggestion, error: insertError } = await serviceClient
      .from("explore_track_venues")
      .insert(insertData as never)
      .select("id")
      .single();

    if (insertError) {
      console.error("Suggestion insert error:", insertError);

      // Handle duplicate suggestion
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "This suggestion already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      suggestion_id: suggestion.id,
      message: "Suggestion submitted successfully. It will be reviewed by our team.",
    }, { status: 201 });
  } catch (error) {
    console.error("Suggest API error:", error);
    return NextResponse.json({ error: "Failed to submit suggestion" }, { status: 500 });
  }
});
