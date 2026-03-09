import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";
import type { FriendHang, VenueHangInfo } from "@/lib/types/hangs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/hangs/venue/[id]
 * Returns hang info for a specific venue.
 * Auth optional — anonymous users see public count only, authenticated users also see friends' hangs.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!ENABLE_HANGS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await context.params;
  const venueId = parseIntParam(id);

  if (venueId === null || venueId <= 0) {
    return NextResponse.json({ error: "Invalid venue ID" }, { status: 400 });
  }

  // Optional auth — don't 401 if no user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const serviceClient = createServiceClient();

  try {
    // Always fetch public hangs at this venue
    const { data: publicRows, error: publicError } = await serviceClient
      .from("hangs")
      .select(`
        id,
        user_id,
        venue_id,
        event_id,
        portal_id,
        status,
        visibility,
        note,
        started_at,
        planned_for,
        auto_expire_at,
        ended_at,
        created_at,
        updated_at,
        profiles!user_id(id, display_name, username, avatar_url)
      `)
      .eq("venue_id", venueId)
      .eq("status", "active")
      .eq("visibility", "public")
      .gt("auto_expire_at", new Date().toISOString());

    if (publicError) {
      logger.error("Venue hangs public query error", publicError, { venueId, component: "hangs/venue/[id]" });
      return NextResponse.json({ error: "Failed to fetch venue hangs" }, { status: 500 });
    }

    type HangProfileRow = {
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
      profiles: {
        id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
    };

    const publicHangs = (publicRows ?? []) as HangProfileRow[];
    const publicCount = publicHangs.length;

    // For authenticated users, also fetch friends' hangs at this venue
    let friendHangs: FriendHang[] = [];

    if (user) {
      // Fetch friends' hangs (visibility friends or public) at this venue via the RPC
      // The get_friends_active_hangs RPC handles all friendship filtering — we filter by venue_id client-side
      const { data: friendRows, error: friendError } = await serviceClient.rpc(
        "get_friends_active_hangs" as never,
        { p_user_id: user.id } as never
      );

      if (friendError) {
        // Non-fatal: log and continue with public data only
        logger.error("Venue hangs friends RPC error", friendError, { userId: user.id, venueId, component: "hangs/venue/[id]" });
      } else {
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

        const allFriendRows = (friendRows ?? []) as FriendsHangRow[];
        const venueRows = allFriendRows.filter((row) => row.venue_id === venueId);

        friendHangs = venueRows.map((row) => ({
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
      }
    }

    // Deduplicate: friends' hangs may overlap with public hangs — prefer friend entry
    const friendUserIds = new Set(friendHangs.map((f) => f.hang.user_id));
    const nonFriendPublic = publicHangs.filter((row) => !friendUserIds.has(row.user_id));

    // total_count = unique people visible to this user
    const totalCount = friendHangs.length + nonFriendPublic.length;

    const result: VenueHangInfo = {
      venue_id: venueId,
      total_count: totalCount,
      friend_hangs: friendHangs,
      public_count: publicCount,
    };

    return NextResponse.json(result);
  } catch (err) {
    logger.error("Venue hangs API error", err, { venueId, component: "hangs/venue/[id]" });
    return NextResponse.json({ error: "Failed to fetch venue hangs" }, { status: 500 });
  }
}
