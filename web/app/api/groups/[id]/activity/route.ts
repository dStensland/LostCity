import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import type { GroupActivity, GroupActivityResponse } from "@/lib/types/groups";

type RouteParams = { id: string };

/**
 * GET /api/groups/[id]/activity
 * Returns derived activity feed for the group (last 30 days, limit 50).
 * Sources: recent hangs, recent spot additions, recent member joins.
 * Membership required.
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

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const activity: GroupActivity[] = [];

    // --- Recent hangs for this group ---
    const { data: hangRows, error: hangError } = await serviceClient
      .from("hangs")
      .select(`
        id,
        user_id,
        venue_id,
        status,
        note,
        started_at,
        planned_for,
        profiles!user_id(id, display_name, username, avatar_url),
        venues!venue_id(id, name, slug)
      `)
      .eq("group_id", groupId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(50);

    if (hangError) {
      logger.error("Group activity hangs error", hangError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/activity",
      });
      // Non-fatal: continue with other sources
    } else {
      type HangRow = {
        id: string;
        user_id: string;
        venue_id: number;
        status: string;
        note: string | null;
        started_at: string;
        planned_for: string | null;
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
        } | null;
      };

      for (const row of (hangRows ?? []) as unknown as HangRow[]) {
        if (!row.profiles) continue;
        const type =
          row.status === "planned" ? "hang_planned" : "hang_started";
        activity.push({
          type,
          timestamp: row.status === "planned" && row.planned_for
            ? row.planned_for
            : row.started_at,
          user: {
            id: row.profiles.id,
            display_name: row.profiles.display_name,
            username: row.profiles.username,
            avatar_url: row.profiles.avatar_url,
          },
          venue: row.venues
            ? { id: row.venues.id, name: row.venues.name, slug: row.venues.slug }
            : undefined,
          note: row.note,
        });
      }
    }

    // --- Recent spot additions ---
    const { data: spotRows, error: spotError } = await serviceClient
      .from("group_spots")
      .select(`
        id,
        added_by,
        note,
        added_at,
        profiles!added_by(id, display_name, username, avatar_url),
        venues!venue_id(id, name, slug)
      `)
      .eq("group_id", groupId)
      .gte("added_at", since)
      .order("added_at", { ascending: false })
      .limit(50);

    if (spotError) {
      logger.error("Group activity spots error", spotError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/activity",
      });
      // Non-fatal
    } else {
      type SpotRow = {
        id: string;
        added_by: string;
        note: string | null;
        added_at: string;
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
        } | null;
      };

      for (const row of (spotRows ?? []) as unknown as SpotRow[]) {
        if (!row.profiles) continue;
        activity.push({
          type: "spot_added",
          timestamp: row.added_at,
          user: {
            id: row.profiles.id,
            display_name: row.profiles.display_name,
            username: row.profiles.username,
            avatar_url: row.profiles.avatar_url,
          },
          venue: row.venues
            ? { id: row.venues.id, name: row.venues.name, slug: row.venues.slug }
            : undefined,
          note: row.note,
        });
      }
    }

    // --- Recent member joins ---
    const { data: memberRows, error: memberError } = await serviceClient
      .from("group_members")
      .select(`
        user_id,
        joined_at,
        profiles!user_id(id, display_name, username, avatar_url)
      `)
      .eq("group_id", groupId)
      .gte("joined_at", since)
      .order("joined_at", { ascending: false })
      .limit(50);

    if (memberError) {
      logger.error("Group activity members error", memberError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/activity",
      });
      // Non-fatal
    } else {
      type NewMemberRow = {
        user_id: string;
        joined_at: string;
        profiles: {
          id: string;
          display_name: string | null;
          username: string | null;
          avatar_url: string | null;
        } | null;
      };

      for (const row of (memberRows ?? []) as unknown as NewMemberRow[]) {
        if (!row.profiles) continue;
        activity.push({
          type: "member_joined",
          timestamp: row.joined_at,
          user: {
            id: row.profiles.id,
            display_name: row.profiles.display_name,
            username: row.profiles.username,
            avatar_url: row.profiles.avatar_url,
          },
        });
      }
    }

    // Merge, sort desc, limit 50
    activity.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const limited = activity.slice(0, 50);

    const response: GroupActivityResponse = { activity: limited };
    return NextResponse.json(response);
  } catch (error) {
    logger.error("Group activity GET error", error, {
      userId: user.id,
      groupId,
      component: "groups/[id]/activity",
    });
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
});
