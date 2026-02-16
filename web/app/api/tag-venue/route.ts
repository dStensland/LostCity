import { NextResponse } from "next/server";
import { checkBodySize, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ALLOWED_DOG_VIBES } from "@/lib/dog-tags";

/**
 * POST /api/tag-venue
 * Add dog-friendly vibes to a venue. Auth required.
 *
 * Body: { venue_id: number, vibes: string[] }
 * Response: { success: true, vibes: string[] } (merged vibes array)
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { venue_id, vibes } = body;

    // venue_id must be a positive integer
    if (typeof venue_id !== "number" || !Number.isInteger(venue_id) || venue_id <= 0) {
      return validationError("Invalid venue_id");
    }

    // vibes must be a non-empty string array (max 20)
    if (!Array.isArray(vibes) || vibes.length === 0 || vibes.length > 20) {
      return validationError("vibes must be a non-empty array (max 20)");
    }

    // Every vibe must be in the allowed set
    const invalidVibes = vibes.filter(
      (v: unknown) => typeof v !== "string" || !ALLOWED_DOG_VIBES.has(v as string)
    );
    if (invalidVibes.length > 0) {
      return validationError(`Invalid vibes: ${invalidVibes.join(", ")}`);
    }

    await ensureUserProfile(user, serviceClient);

    // Fetch existing venue
    const { data: venue, error: fetchError } = await serviceClient
      .from("venues")
      .select("id, vibes")
      .eq("id", venue_id)
      .eq("active", true)
      .maybeSingle();

    if (fetchError) {
      logger.error("tag-venue fetch error", fetchError, {
        userId: user.id,
        venueId: venue_id,
        component: "tag-venue",
      });
      return NextResponse.json({ error: "Failed to fetch venue" }, { status: 500 });
    }

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Cast after null check to avoid Supabase `never` type issue
    const existingVenue = venue as { id: number; vibes: string[] | null };

    // Merge vibes (no duplicates)
    const existingVibes = existingVenue.vibes || [];
    const mergedVibes = [...new Set([...existingVibes, ...vibes])];

    const { error: updateError } = await serviceClient
      .from("venues")
      .update({ vibes: mergedVibes, updated_at: new Date().toISOString() } as never)
      .eq("id", venue_id);

    if (updateError) {
      logger.error("tag-venue update error", updateError, {
        userId: user.id,
        venueId: venue_id,
        component: "tag-venue",
      });
      return NextResponse.json({ error: "Failed to update venue" }, { status: 500 });
    }

    return NextResponse.json({ success: true, vibes: mergedVibes });
  } catch (error) {
    logger.error("tag-venue API error", error, { userId: user.id, component: "tag-venue" });
    return NextResponse.json({ error: "Failed to tag venue" }, { status: 500 });
  }
});
