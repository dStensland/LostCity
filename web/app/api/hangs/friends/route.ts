import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";
import type { FriendHang } from "@/lib/types/hangs";

/**
 * GET /api/hangs/friends
 * Returns active hangs from the authenticated user's friends.
 * Auth required — friends list is user-scoped.
 */
export const GET = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_HANGS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { data, error } = await serviceClient.rpc("get_friends_active_hangs" as never, {
      p_user_id: user.id,
    } as never);

    if (error) {
      logger.error("Friends hangs RPC error", error, { userId: user.id, component: "hangs/friends" });
      return NextResponse.json({ error: "Failed to fetch friends' hangs" }, { status: 500 });
    }

    type FriendsHangRow = {
      id: string;
      user_id: string;
      venue_id: number;
      event_id: number | null;
      portal_id: string | null;
      status: string;
      visibility: string;
      note: string | null;
      started_at: string;
      planned_for: string | null;
      auto_expire_at: string;
      ended_at: string | null;
      created_at: string;
      updated_at: string;
      profile_display_name: string | null;
      profile_username: string | null;
      profile_avatar_url: string | null;
      venue_name: string;
      venue_slug: string | null;
      venue_image_url: string | null;
      venue_neighborhood: string | null;
    };

    const rows = (data ?? []) as FriendsHangRow[];

    // Defense-in-depth: filter blocked users even though enforce_block_unfriend
    // should prevent blocked users from appearing as friends
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

    const filteredRows = rows.filter((row) => !blockedIds.has(row.user_id));

    const friends: FriendHang[] = filteredRows.map((row) => ({
      hang: {
        id: row.id,
        user_id: row.user_id,
        venue_id: row.venue_id,
        event_id: row.event_id,
        portal_id: row.portal_id,
        status: row.status as FriendHang["hang"]["status"],
        visibility: row.visibility as FriendHang["hang"]["visibility"],
        note: row.note,
        started_at: row.started_at,
        planned_for: row.planned_for,
        auto_expire_at: row.auto_expire_at,
        ended_at: row.ended_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        venue: {
          id: row.venue_id,
          name: row.venue_name,
          slug: row.venue_slug,
          image_url: row.venue_image_url,
          neighborhood: row.venue_neighborhood,
          address: null,
        },
      },
      profile: {
        id: row.user_id,
        display_name: row.profile_display_name,
        username: row.profile_username,
        avatar_url: row.profile_avatar_url,
      },
    }));

    return NextResponse.json({ friends, count: friends.length });
  } catch (err) {
    logger.error("Friends hangs API error", err, { userId: user.id, component: "hangs/friends" });
    return NextResponse.json({ error: "Failed to fetch friends' hangs" }, { status: 500 });
  }
});
