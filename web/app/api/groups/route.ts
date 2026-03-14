import { NextResponse } from "next/server";
import { checkBodySize, validationError, isValidString, isValidEnum } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUPS_PER_USER,
  DEFAULT_MAX_MEMBERS,
} from "@/lib/types/groups";
import type {
  CreateGroupRequest,
  GroupVisibility,
  GroupWithMeta,
  MyGroupsResponse,
} from "@/lib/types/groups";

const VALID_VISIBILITIES: readonly GroupVisibility[] = ["private", "unlisted"];

/**
 * POST /api/groups
 * Create a new group. The creator is automatically added as an admin member.
 * Enforces a max of MAX_GROUPS_PER_USER groups per user.
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body: CreateGroupRequest = await request.json();
    const { name, description, emoji, visibility = "private" } = body;

    // Validation
    if (!isValidString(name, 2, MAX_GROUP_NAME_LENGTH)) {
      return validationError(`name is required and must be between 2 and ${MAX_GROUP_NAME_LENGTH} characters`);
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

    if (!isValidEnum(visibility, VALID_VISIBILITIES)) {
      return validationError("visibility must be private or unlisted");
    }

    // Enforce max groups per user
    const { count, error: countError } = await serviceClient
      .from("groups")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", user.id);

    if (countError) {
      logger.error("Groups count error", countError, { userId: user.id, component: "groups" });
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
    }

    if ((count ?? 0) >= MAX_GROUPS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_GROUPS_PER_USER} groups allowed` },
        { status: 422 }
      );
    }

    // Generate invite code
    const { randomBytes } = await import("crypto");
    const inviteCode = randomBytes(8).toString("hex");

    // Insert group
    const { data: group, error: insertError } = await serviceClient
      .from("groups")
      .insert({
        name: name.trim(),
        description: description?.trim() ?? null,
        emoji: emoji ?? null,
        creator_id: user.id,
        invite_code: inviteCode,
        visibility,
        max_members: DEFAULT_MAX_MEMBERS,
      } as never)
      .select()
      .single();

    if (insertError || !group) {
      logger.error("Group insert error", insertError, { userId: user.id, component: "groups" });
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
    }

    const groupRow = group as { id: string };

    // Insert creator as admin member
    const { error: memberError } = await serviceClient
      .from("group_members")
      .insert({
        group_id: groupRow.id,
        user_id: user.id,
        role: "admin",
      } as never);

    if (memberError) {
      logger.error("Group member insert error (creator)", memberError, {
        userId: user.id,
        groupId: groupRow.id,
        component: "groups",
      });
      // Group was created — non-fatal but worth logging. The creator may
      // appear memberless until the record is repaired.
    }

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    logger.error("Groups POST error", error, { userId: user.id, component: "groups" });
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
});

/**
 * GET /api/groups
 * List all groups the authenticated user belongs to.
 * Returns each group with member_count and active_hang_count.
 * Sorted by most recent activity.
 */
export const GET = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Fetch all groups where the user is a member
    const { data: memberRows, error: memberError } = await serviceClient
      .from("group_members")
      .select("group_id, role, joined_at")
      .eq("user_id", user.id);

    if (memberError) {
      logger.error("Groups GET member query error", memberError, {
        userId: user.id,
        component: "groups",
      });
      return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
    }

    if (!memberRows || memberRows.length === 0) {
      const response: MyGroupsResponse = { groups: [] };
      return NextResponse.json(response);
    }

    type MemberRow = { group_id: string; role: string; joined_at: string };
    const rows = memberRows as MemberRow[];
    const groupIds = rows.map((r) => r.group_id);

    // Fetch group records
    const { data: groups, error: groupsError } = await serviceClient
      .from("groups")
      .select("*")
      .in("id", groupIds);

    if (groupsError) {
      logger.error("Groups GET query error", groupsError, {
        userId: user.id,
        component: "groups",
      });
      return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
    }

    type GroupRow = {
      id: string;
      name: string;
      description: string | null;
      emoji: string | null;
      avatar_url: string | null;
      creator_id: string;
      invite_code: string;
      visibility: GroupVisibility;
      max_members: number;
      created_at: string;
      updated_at: string;
    };

    const groupsData = (groups ?? []) as GroupRow[];

    // Fetch member counts per group
    const { data: memberCounts, error: countError } = await serviceClient
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);

    if (countError) {
      logger.error("Groups member count error", countError, {
        userId: user.id,
        component: "groups",
      });
    }

    type CountRow = { group_id: string };
    const countRows = (memberCounts ?? []) as CountRow[];
    const memberCountMap = new Map<string, number>();
    for (const row of countRows) {
      memberCountMap.set(row.group_id, (memberCountMap.get(row.group_id) ?? 0) + 1);
    }

    // Fetch active hang counts per group
    const now = new Date().toISOString();
    const { data: hangRows, error: hangError } = await serviceClient
      .from("hangs")
      .select("group_id")
      .in("group_id", groupIds)
      .eq("status", "active")
      .gt("auto_expire_at", now);

    if (hangError) {
      logger.error("Groups hang count error", hangError, {
        userId: user.id,
        component: "groups",
      });
    }

    type HangRow = { group_id: string | null };
    const activeHangRows = (hangRows ?? []) as HangRow[];
    const hangCountMap = new Map<string, number>();
    for (const row of activeHangRows) {
      if (row.group_id) {
        hangCountMap.set(row.group_id, (hangCountMap.get(row.group_id) ?? 0) + 1);
      }
    }

    // Build response with meta
    const withMeta: GroupWithMeta[] = groupsData.map((g) => ({
      ...g,
      member_count: memberCountMap.get(g.id) ?? 1,
      active_hang_count: hangCountMap.get(g.id) ?? 0,
      latest_activity: null,
      latest_activity_at: g.updated_at,
    }));

    // Sort by most recent activity (updated_at descending)
    withMeta.sort((a, b) => {
      const aTime = a.latest_activity_at ?? a.created_at;
      const bTime = b.latest_activity_at ?? b.created_at;
      return bTime.localeCompare(aTime);
    });

    const response: MyGroupsResponse = { groups: withMeta };
    return NextResponse.json(response);
  } catch (error) {
    logger.error("Groups GET error", error, { userId: user.id, component: "groups" });
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
});
