import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";

type RouteParams = { id: string };

/**
 * POST /api/groups/[id]/invite-code
 * Regenerate the group's invite code. Admin only.
 * Returns the new invite code.
 */
export const POST = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId } = params;

  try {
    // Verify the caller is an admin
    const { data: membership, error: membershipError } = await serviceClient
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      logger.error("Group membership check error (invite-code)", membershipError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/invite-code",
      });
      return NextResponse.json({ error: "Failed to regenerate invite code" }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    type MembershipRow = { role: string };
    if ((membership as MembershipRow).role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Generate new invite code
    const { randomBytes } = await import("crypto");
    const newCode = randomBytes(8).toString("hex");

    const { error: updateError } = await serviceClient
      .from("groups")
      .update({ invite_code: newCode } as never)
      .eq("id", groupId);

    if (updateError) {
      logger.error("Group invite code update error", updateError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/invite-code",
      });
      return NextResponse.json({ error: "Failed to regenerate invite code" }, { status: 500 });
    }

    return NextResponse.json({ invite_code: newCode });
  } catch (error) {
    logger.error("Group invite-code POST error", error, {
      userId: user.id,
      groupId,
      component: "groups/[id]/invite-code",
    });
    return NextResponse.json({ error: "Failed to regenerate invite code" }, { status: 500 });
  }
});
