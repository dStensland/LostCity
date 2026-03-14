import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";

type RouteParams = { id: string; spotId: string };

/**
 * DELETE /api/groups/[id]/spots/[spotId]
 * Remove a spot from the group. Membership required.
 */
export const DELETE = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId, spotId } = params;

  try {
    // Verify membership
    const { data: membership } = await serviceClient
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Delete the spot (scoped to group_id to prevent cross-group deletions)
    const { error: deleteError } = await serviceClient
      .from("group_spots")
      .delete()
      .eq("id", spotId)
      .eq("group_id", groupId);

    if (deleteError) {
      logger.error("Group spot delete error", deleteError, {
        userId: user.id,
        groupId,
        spotId,
        component: "groups/[id]/spots/[spotId]",
      });
      return NextResponse.json({ error: "Failed to remove spot" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Group spot DELETE error", error, {
      userId: user.id,
      groupId,
      spotId,
      component: "groups/[id]/spots/[spotId]",
    });
    return NextResponse.json({ error: "Failed to remove spot" }, { status: 500 });
  }
});
