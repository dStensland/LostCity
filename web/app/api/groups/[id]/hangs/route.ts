import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import type { GroupHangsResponse, GroupHangWithProfile } from "@/lib/types/groups";

type RouteParams = { id: string };

/**
 * GET /api/groups/[id]/hangs
 * Returns active and planned hangs for a group.
 * Membership required. Block filtering applied.
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

    const now = new Date().toISOString();

    // Fetch active + planned hangs for this group
    const { data: hangRows, error: hangsError } = await serviceClient
      .from("hangs")
      .select(`
        id,
        user_id,
        venue_id,
        status,
        note,
        started_at,
        planned_for,
        auto_expire_at,
        profiles!user_id(id, display_name, username, avatar_url),
        venues!venue_id(id, name, slug, image_url, neighborhood)
      `)
      .eq("group_id", groupId)
      .in("status", ["active", "planned"])
      .or(`status.eq.planned,and(status.eq.active,auto_expire_at.gt.${now})`)
      .order("started_at", { ascending: false });

    if (hangsError) {
      logger.error("Group hangs fetch error", hangsError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/hangs",
      });
      return NextResponse.json({ error: "Failed to fetch hangs" }, { status: 500 });
    }

    // Block filtering
    const { data: blocks } = await serviceClient
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

    const blockedIds = new Set<string>();
    if (blocks) {
      for (const b of blocks as { blocker_id: string; blocked_id: string }[]) {
        blockedIds.add(b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
      }
    }

    type HangRow = {
      id: string;
      user_id: string;
      venue_id: number;
      status: string;
      note: string | null;
      started_at: string;
      planned_for: string | null;
      auto_expire_at: string;
      profiles: {
        id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
      venues: {
        id: number;
        name: string;
        slug: string | null;
        image_url: string | null;
        neighborhood: string | null;
      } | null;
    };

    const rows = (hangRows ?? []) as unknown as HangRow[];
    const filtered = rows.filter((r) => !blockedIds.has(r.user_id) && r.profiles && r.venues);

    const toHangWithProfile = (row: HangRow): GroupHangWithProfile => ({
      id: row.id,
      user_id: row.user_id,
      venue_id: row.venue_id,
      status: row.status as GroupHangWithProfile["status"],
      note: row.note,
      started_at: row.started_at,
      planned_for: row.planned_for,
      auto_expire_at: row.auto_expire_at,
      profile: {
        id: row.profiles!.id,
        display_name: row.profiles!.display_name,
        username: row.profiles!.username,
        avatar_url: row.profiles!.avatar_url,
      },
      venue: {
        id: row.venues!.id,
        name: row.venues!.name,
        slug: row.venues!.slug,
        image_url: row.venues!.image_url,
        neighborhood: row.venues!.neighborhood,
      },
    });

    const active: GroupHangWithProfile[] = filtered
      .filter((r) => r.status === "active" && r.auto_expire_at > now)
      .map(toHangWithProfile);

    const planned: GroupHangWithProfile[] = filtered
      .filter((r) => r.status === "planned")
      .map(toHangWithProfile);

    const response: GroupHangsResponse = { active, planned };
    return NextResponse.json(response);
  } catch (error) {
    logger.error("Group hangs GET error", error, {
      userId: user.id,
      groupId,
      component: "groups/[id]/hangs",
    });
    return NextResponse.json({ error: "Failed to fetch hangs" }, { status: 500 });
  }
});
