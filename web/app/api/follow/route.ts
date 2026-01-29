import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isFollowing: false });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  const targetVenueId = searchParams.get("venueId");
  const targetOrganizationId = searchParams.get("organizationId");

  if (!targetUserId && !targetVenueId && !targetOrganizationId) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  try {
    let query = supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id);

    if (targetUserId) {
      query = query.eq("followed_user_id", targetUserId);
    } else if (targetVenueId) {
      query = query.eq("followed_venue_id", parseInt(targetVenueId));
    } else if (targetOrganizationId) {
      query = query.eq("followed_organization_id", targetOrganizationId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Follow check error:", error);
      return NextResponse.json({ isFollowing: false, error: error.message });
    }

    return NextResponse.json({ isFollowing: !!data });
  } catch (err) {
    console.error("Follow check exception:", err);
    return NextResponse.json({ isFollowing: false, error: "Server error" });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { targetUserId, targetVenueId, targetOrganizationId, action } = body;

  if (!targetUserId && !targetVenueId && !targetOrganizationId) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  if (action !== "follow" && action !== "unfollow") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    if (action === "unfollow") {
      let query = supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id);

      if (targetUserId) {
        query = query.eq("followed_user_id", targetUserId);
      } else if (targetVenueId) {
        query = query.eq("followed_venue_id", targetVenueId);
      } else if (targetOrganizationId) {
        query = query.eq("followed_organization_id", targetOrganizationId);
      }

      const { error } = await query;

      if (error) {
        console.error("Unfollow error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, isFollowing: false });
    } else {
      // Follow
      const followData: Record<string, unknown> = {
        follower_id: user.id,
      };

      if (targetUserId) {
        followData.followed_user_id = targetUserId;
      } else if (targetVenueId) {
        followData.followed_venue_id = targetVenueId;
      } else if (targetOrganizationId) {
        followData.followed_organization_id = targetOrganizationId;
      }

      const { error } = await supabase.from("follows").insert(followData as never);

      if (error) {
        // Check if it's a duplicate
        if (error.code === "23505") {
          return NextResponse.json({ success: true, isFollowing: true });
        }
        console.error("Follow error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, isFollowing: true });
    }
  } catch (err) {
    console.error("Follow action exception:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
