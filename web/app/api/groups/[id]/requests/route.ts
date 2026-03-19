import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import type { GroupJoinRequest } from "@/lib/types/groups";

type RouteParams = { id: string };

/**
 * GET /api/groups/[id]/requests
 * List pending join requests for a group. Admin only.
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

    // Fetch pending requests with profiles
    const { data: requests, error: reqError } = await serviceClient
      .from("group_join_requests")
      .select(`
        id,
        group_id,
        user_id,
        message,
        status,
        decided_by,
        created_at,
        decided_at,
        profiles!user_id(id, display_name, username, avatar_url)
      `)
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (reqError) {
      logger.error("Group requests fetch error", reqError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/requests",
      });
      return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
    }

    type RequestRow = {
      id: string;
      group_id: string;
      user_id: string;
      message: string | null;
      status: string;
      decided_by: string | null;
      created_at: string;
      decided_at: string | null;
      profiles: {
        id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
    };

    const rows = (requests ?? []) as unknown as RequestRow[];
    const formatted: GroupJoinRequest[] = rows.map((r) => ({
      id: r.id,
      group_id: r.group_id,
      user_id: r.user_id,
      message: r.message,
      status: r.status as GroupJoinRequest["status"],
      decided_by: r.decided_by,
      created_at: r.created_at,
      decided_at: r.decided_at,
      profile: r.profiles
        ? {
            id: r.profiles.id,
            display_name: r.profiles.display_name,
            username: r.profiles.username,
            avatar_url: r.profiles.avatar_url,
          }
        : undefined,
    }));

    return NextResponse.json({ requests: formatted });
  } catch (error) {
    logger.error("Group requests GET error", error, {
      userId: user.id,
      groupId,
      component: "groups/[id]/requests",
    });
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
});
