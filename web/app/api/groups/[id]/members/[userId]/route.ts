import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";

type RouteParams = { id: string; userId: string };

/**
 * DELETE /api/groups/[id]/members/[userId]
 * Remove a member from the group.
 * - Self-leave: any member can remove themselves
 * - Admin-remove: admins can remove non-creator members
 * - Creator protection: the group creator cannot be removed
 */
export const DELETE = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId, userId: targetUserId } = params;

  try {
    const isSelfLeave = user.id === targetUserId;

    if (!isSelfLeave) {
      // Admin-remove: verify the caller is an admin
      const { data: callerMembership } = await serviceClient
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!callerMembership) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      type MembershipRow = { role: string };
      if ((callerMembership as MembershipRow).role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    // Prevent removing the group creator
    const { data: group } = await serviceClient
      .from("groups")
      .select("creator_id")
      .eq("id", groupId)
      .single();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    type GroupRow = { creator_id: string };
    if ((group as GroupRow).creator_id === targetUserId && !isSelfLeave) {
      return NextResponse.json(
        { error: "Cannot remove the group creator" },
        { status: 403 }
      );
    }

    // Delete the membership
    const { error: deleteError } = await serviceClient
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (deleteError) {
      logger.error("Group member remove error", deleteError, {
        userId: user.id,
        groupId,
        targetUserId,
        component: "groups/[id]/members/[userId]",
      });
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Group member DELETE error", error, {
      userId: user.id,
      groupId,
      targetUserId,
      component: "groups/[id]/members/[userId]",
    });
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
});
