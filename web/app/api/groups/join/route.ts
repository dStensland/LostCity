import { NextResponse } from "next/server";
import { checkBodySize, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import { MAX_MEMBERS_PER_GROUP } from "@/lib/types/groups";

/**
 * POST /api/groups/join
 * Join a group via an invite code.
 * Body: { invite_code: string }
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sizeCheck = checkBodySize(request, 2048);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { invite_code, group_id } = body;

    // Either invite_code or group_id is required (group_id for public groups)
    if (!invite_code && !group_id) {
      return validationError("invite_code or group_id is required");
    }

    if (invite_code && typeof invite_code !== "string") {
      return validationError("invite_code must be a string");
    }

    if (group_id && typeof group_id !== "string") {
      return validationError("group_id must be a string");
    }

    // Look up group by invite code or group_id
    let groupQuery = serviceClient
      .from("groups")
      .select("id, name, description, emoji, avatar_url, creator_id, invite_code, visibility, join_policy, max_members, created_at, updated_at");

    if (invite_code) {
      groupQuery = groupQuery.eq("invite_code", invite_code.trim());
    } else {
      groupQuery = groupQuery.eq("id", group_id);
    }

    const { data: group, error: groupError } = await groupQuery.maybeSingle();

    if (groupError) {
      logger.error("Group join lookup error", groupError, {
        userId: user.id,
        component: "groups/join",
      });
      return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
    }

    if (!group) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    type GroupRow = {
      id: string;
      name: string;
      description: string | null;
      emoji: string | null;
      avatar_url: string | null;
      creator_id: string;
      invite_code: string;
      visibility: string;
      join_policy: string;
      max_members: number;
      created_at: string;
      updated_at: string;
    };

    const groupRow = group as GroupRow;

    // If joining by group_id (no invite code), group must be public
    if (!invite_code && groupRow.visibility !== "public") {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    // Check if user is already a member
    const { data: existing } = await serviceClient
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupRow.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Already a member — return the group as success
      return NextResponse.json({ group: groupRow });
    }

    // Check max members
    const { count, error: countError } = await serviceClient
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", groupRow.id);

    if (countError) {
      logger.error("Group member count error (join)", countError, {
        userId: user.id,
        groupId: groupRow.id,
        component: "groups/join",
      });
      return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
    }

    const maxMembers = groupRow.max_members ?? MAX_MEMBERS_PER_GROUP;
    if ((count ?? 0) >= maxMembers) {
      return NextResponse.json({ error: "Group is full" }, { status: 422 });
    }

    // Branch on join_policy for public groups joined by group_id (no invite code)
    if (!invite_code && groupRow.join_policy === "request") {
      // Check for existing pending request
      const { data: existingRequest } = await serviceClient
        .from("group_join_requests")
        .select("id, status")
        .eq("group_id", groupRow.id)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        return NextResponse.json({ status: "pending", message: "Request already submitted" });
      }

      // Insert join request
      const { error: requestError } = await serviceClient
        .from("group_join_requests")
        .insert({
          group_id: groupRow.id,
          user_id: user.id,
          message: body.message?.trim()?.slice(0, 280) ?? null,
        } as never);

      if (requestError) {
        if (requestError.code === "23505") {
          return NextResponse.json({ status: "pending", message: "Request already submitted" });
        }
        logger.error("Group join request insert error", requestError, {
          userId: user.id,
          groupId: groupRow.id,
          component: "groups/join",
        });
        return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
      }

      return NextResponse.json({ status: "pending", message: "Join request submitted" }, { status: 201 });
    }

    // For invite-code joins or open policy: insert member directly
    if (!invite_code && groupRow.join_policy === "invite") {
      return NextResponse.json({ error: "This group requires an invite" }, { status: 403 });
    }

    // Insert member (open policy or invite code)
    const { error: insertError } = await serviceClient
      .from("group_members")
      .insert({
        group_id: groupRow.id,
        user_id: user.id,
        role: "member",
      } as never);

    if (insertError) {
      // Race condition: already inserted
      if (insertError.code === "23505") {
        return NextResponse.json({ group: groupRow });
      }
      logger.error("Group member insert error (join)", insertError, {
        userId: user.id,
        groupId: groupRow.id,
        component: "groups/join",
      });
      return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
    }

    return NextResponse.json({ group: groupRow }, { status: 201 });
  } catch (error) {
    logger.error("Groups join POST error", error, { userId: user.id, component: "groups/join" });
    return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
  }
});
