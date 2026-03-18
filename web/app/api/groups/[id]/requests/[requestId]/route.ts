import { NextResponse } from "next/server";
import { checkBodySize, validationError, isValidEnum } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import { MAX_MEMBERS_PER_GROUP } from "@/lib/types/groups";

type RouteParams = { id: string; requestId: string };

const VALID_DECISIONS = ["approved", "denied"] as const;

/**
 * PATCH /api/groups/[id]/requests/[requestId]
 * Approve or deny a join request. Admin only.
 * On approve: insert into group_members (checking max), update request status.
 * On deny: update request status.
 */
export const PATCH = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId, requestId } = params;

  try {
    // Verify admin
    const { data: membership } = await serviceClient
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    type MembershipRow = { role: string };
    if ((membership as MembershipRow).role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { status: decision } = body;

    if (!isValidEnum(decision, VALID_DECISIONS)) {
      return validationError("status must be approved or denied");
    }

    // Fetch the request
    const { data: joinRequest, error: reqError } = await serviceClient
      .from("group_join_requests")
      .select("id, group_id, user_id, status")
      .eq("id", requestId)
      .eq("group_id", groupId)
      .maybeSingle();

    if (reqError) {
      logger.error("Join request fetch error", reqError, {
        userId: user.id,
        groupId,
        requestId,
        component: "groups/[id]/requests/[requestId]",
      });
      return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }

    if (!joinRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    type RequestRow = { id: string; group_id: string; user_id: string; status: string };
    const req = joinRequest as RequestRow;

    if (req.status !== "pending") {
      return NextResponse.json({ error: "Request already processed" }, { status: 409 });
    }

    if (decision === "approved") {
      // Check max members before approving
      const { count, error: countError } = await serviceClient
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId);

      if (countError) {
        logger.error("Group member count error (approve)", countError, {
          userId: user.id,
          groupId,
          component: "groups/[id]/requests/[requestId]",
        });
        return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
      }

      // Get max_members from group
      const { data: groupData } = await serviceClient
        .from("groups")
        .select("max_members")
        .eq("id", groupId)
        .single();

      type GroupRow = { max_members: number };
      const maxMembers = (groupData as GroupRow | null)?.max_members ?? MAX_MEMBERS_PER_GROUP;

      if ((count ?? 0) >= maxMembers) {
        return NextResponse.json({ error: "Group is full" }, { status: 422 });
      }

      // Insert member
      const { error: memberError } = await serviceClient
        .from("group_members")
        .insert({
          group_id: groupId,
          user_id: req.user_id,
          role: "member",
          invited_by: user.id,
        } as never);

      if (memberError) {
        // Already a member (race condition) — still update the request
        if (memberError.code !== "23505") {
          logger.error("Group member insert error (approve)", memberError, {
            userId: user.id,
            groupId,
            requestId,
            component: "groups/[id]/requests/[requestId]",
          });
          return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
        }
      }
    }

    // Update request status
    const { error: updateError } = await serviceClient
      .from("group_join_requests")
      .update({
        status: decision,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", requestId);

    if (updateError) {
      logger.error("Join request update error", updateError, {
        userId: user.id,
        groupId,
        requestId,
        component: "groups/[id]/requests/[requestId]",
      });
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }

    return NextResponse.json({ status: decision });
  } catch (error) {
    logger.error("Join request PATCH error", error, {
      userId: user.id,
      groupId,
      requestId,
      component: "groups/[id]/requests/[requestId]",
    });
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
});
