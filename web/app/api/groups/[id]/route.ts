import { NextResponse } from "next/server";
import { checkBodySize, validationError, isValidString, isValidEnum } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUP_DESCRIPTION_LENGTH,
} from "@/lib/types/groups";
import type {
  UpdateGroupRequest,
  GroupVisibility,
  GroupDetailResponse,
  GroupMemberRole,
} from "@/lib/types/groups";

const VALID_VISIBILITIES: readonly GroupVisibility[] = ["private", "unlisted"];

type RouteParams = { id: string };

/**
 * GET /api/groups/[id]
 * Returns group detail + members + the caller's role.
 * Only accessible to current members.
 */
export const GET = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId } = params;

  try {
    // Verify the caller is a member and get their role
    const { data: membership, error: membershipError } = await serviceClient
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      logger.error("Group membership check error", membershipError, {
        userId: user.id,
        groupId,
        component: "groups/[id]",
      });
      return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    type MembershipRow = { role: string };
    const myRole = (membership as MembershipRow).role as GroupMemberRole;

    // Fetch group
    const { data: group, error: groupError } = await serviceClient
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      logger.error("Group fetch error", groupError, {
        userId: user.id,
        groupId,
        component: "groups/[id]",
      });
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Fetch members with profiles
    const { data: members, error: membersError } = await serviceClient
      .from("group_members")
      .select(`
        group_id,
        user_id,
        role,
        joined_at,
        invited_by,
        profiles!user_id(id, display_name, username, avatar_url)
      `)
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (membersError) {
      logger.error("Group members fetch error", membersError, {
        userId: user.id,
        groupId,
        component: "groups/[id]",
      });
      return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 });
    }

    type MemberRow = {
      group_id: string;
      user_id: string;
      role: string;
      joined_at: string;
      invited_by: string | null;
      profiles: {
        id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
    };

    const memberRows = (members ?? []) as unknown as MemberRow[];
    const membersFormatted = memberRows.map((m) => ({
      group_id: m.group_id,
      user_id: m.user_id,
      role: m.role as GroupMemberRole,
      joined_at: m.joined_at,
      invited_by: m.invited_by,
      profile: m.profiles
        ? {
            id: m.profiles.id,
            display_name: m.profiles.display_name,
            username: m.profiles.username,
            avatar_url: m.profiles.avatar_url,
          }
        : undefined,
    }));

    const response: GroupDetailResponse = {
      group: group as GroupDetailResponse["group"],
      members: membersFormatted,
      my_role: myRole,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Groups GET [id] error", error, { userId: user.id, groupId, component: "groups/[id]" });
    return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 });
  }
});

/**
 * PATCH /api/groups/[id]
 * Update group fields. Admin only.
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
      logger.error("Group membership check error (PATCH)", membershipError, {
        userId: user.id,
        groupId,
        component: "groups/[id]",
      });
      return NextResponse.json({ error: "Failed to update group" }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    type MembershipRow = { role: string };
    if ((membership as MembershipRow).role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body: UpdateGroupRequest = await request.json();
    const { name, description, emoji, avatar_url, visibility } = body;

    // Validate provided fields
    if (name !== undefined) {
      if (!isValidString(name, 2, MAX_GROUP_NAME_LENGTH)) {
        return validationError(`name must be between 2 and ${MAX_GROUP_NAME_LENGTH} characters`);
      }
    }

    if (description !== undefined && description !== null) {
      if (!isValidString(description, 0, MAX_GROUP_DESCRIPTION_LENGTH)) {
        return validationError(`description must be at most ${MAX_GROUP_DESCRIPTION_LENGTH} characters`);
      }
    }

    if (emoji !== undefined && emoji !== null) {
      if (typeof emoji !== "string" || emoji.length === 0 || emoji.length > 8) {
        return validationError("emoji must be a non-empty string");
      }
    }

    if (visibility !== undefined && !isValidEnum(visibility, VALID_VISIBILITIES)) {
      return validationError("visibility must be private or unlisted");
    }

    // Build update payload from provided fields only
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() ?? null;
    if (emoji !== undefined) updates.emoji = emoji;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (visibility !== undefined) updates.visibility = visibility;

    if (Object.keys(updates).length === 0) {
      return validationError("Provide at least one field to update");
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("groups")
      .update(updates as never)
      .eq("id", groupId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error("Group update error", updateError, {
        userId: user.id,
        groupId,
        component: "groups/[id]",
      });
      return NextResponse.json({ error: "Failed to update group" }, { status: 500 });
    }

    return NextResponse.json({ group: updated });
  } catch (error) {
    logger.error("Groups PATCH error", error, { userId: user.id, groupId, component: "groups/[id]" });
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 });
  }
});

/**
 * DELETE /api/groups/[id]
 * Delete the group. Creator only. CASCADE handles members and spots.
 */
export const DELETE = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId } = params;

  try {
    // Verify the caller is the creator
    const { data: group, error: groupError } = await serviceClient
      .from("groups")
      .select("creator_id")
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) {
      logger.error("Group fetch error (DELETE)", groupError, {
        userId: user.id,
        groupId,
        component: "groups/[id]",
      });
      return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
    }

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    type GroupRow = { creator_id: string };
    if ((group as GroupRow).creator_id !== user.id) {
      return NextResponse.json({ error: "Only the group creator can delete the group" }, { status: 403 });
    }

    const { error: deleteError } = await serviceClient
      .from("groups")
      .delete()
      .eq("id", groupId);

    if (deleteError) {
      logger.error("Group delete error", deleteError, {
        userId: user.id,
        groupId,
        component: "groups/[id]",
      });
      return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Groups DELETE error", error, { userId: user.id, groupId, component: "groups/[id]" });
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
});
