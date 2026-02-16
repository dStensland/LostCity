import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidEnum, isValidUUID } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";

const ENTITY_TYPES = ["track_venue", "tip"] as const;
type EntityType = typeof ENTITY_TYPES[number];

/**
 * POST /api/explore/upvote
 * Toggle upvote on track_venue or tip
 * Body: { entityType: 'track_venue'|'tip', entityId: string }
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
    const { entityType, entityId } = body;

    // Validate input
    if (!isValidEnum(entityType, ENTITY_TYPES)) {
      return validationError("Invalid entityType. Must be 'track_venue' or 'tip'");
    }

    if (!isValidUUID(entityId)) {
      return validationError("Invalid entityId. Must be a valid UUID");
    }

    // Ensure profile exists
    await ensureUserProfile(user, serviceClient);

    // Check if upvote already exists
    const { data: existingUpvote } = await serviceClient
      .from("explore_upvotes")
      .select("id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingUpvote) {
      // Toggle off - delete the upvote
      const { error: deleteError } = await serviceClient
        .from("explore_upvotes")
        .delete()
        .eq("id", existingUpvote.id);

      if (deleteError) {
        console.error("Upvote delete error:", deleteError);
        return NextResponse.json({ error: "Failed to remove upvote" }, { status: 500 });
      }

      // Get updated count from the entity
      const newCount = await getEntityUpvoteCount(serviceClient, entityType, entityId);

      return NextResponse.json({
        success: true,
        upvoted: false,
        upvote_count: newCount,
      });
    } else {
      // Toggle on - insert the upvote
      const { error: insertError } = await serviceClient
        .from("explore_upvotes")
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          user_id: user.id,
        } as never);

      if (insertError) {
        // Handle race condition where another request created the upvote
        if (insertError.code === "23505") {
          const newCount = await getEntityUpvoteCount(serviceClient, entityType, entityId);
          return NextResponse.json({
            success: true,
            upvoted: true,
            upvote_count: newCount,
          });
        }
        console.error("Upvote insert error:", insertError);
        return NextResponse.json({ error: "Failed to add upvote" }, { status: 500 });
      }

      // Get updated count from the entity (trigger should have incremented it)
      const newCount = await getEntityUpvoteCount(serviceClient, entityType, entityId);

      return NextResponse.json({
        success: true,
        upvoted: true,
        upvote_count: newCount,
      });
    }
  } catch (error) {
    console.error("Upvote API error:", error);
    return NextResponse.json({ error: "Failed to toggle upvote" }, { status: 500 });
  }
});

// Helper to get current upvote count from the entity
async function getEntityUpvoteCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: any,
  entityType: EntityType,
  entityId: string
): Promise<number> {
  if (entityType === "track_venue") {
    const { data } = await serviceClient
      .from("explore_track_venues")
      .select("upvote_count")
      .eq("id", entityId)
      .maybeSingle();
    return data?.upvote_count ?? 0;
  } else {
    const { data } = await serviceClient
      .from("explore_tips")
      .select("upvote_count")
      .eq("id", entityId)
      .maybeSingle();
    return data?.upvote_count ?? 0;
  }
}
