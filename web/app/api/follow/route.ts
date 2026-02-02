import { NextResponse } from "next/server";
import { checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withOptionalAuth, withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";

export const GET = withOptionalAuth(async (request, { user, serviceClient }) => {
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
    let query = serviceClient
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
      logger.error("Follow check error", error, { userId: user.id, targetUserId, targetVenueId, targetOrganizationId, component: "follow" });
      return NextResponse.json({ isFollowing: false, error: "Failed to check follow status" });
    }

    return NextResponse.json({ isFollowing: !!data });
  } catch (err) {
    logger.error("Follow check exception", err, { userId: user.id, component: "follow" });
    return NextResponse.json({ isFollowing: false, error: "Server error" });
  }
});

export const POST = withAuth(async (request, { user, serviceClient }) => {
  // Check body size (10KB limit)
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const { targetUserId, targetVenueId, targetOrganizationId, action } = body;

  if (!targetUserId && !targetVenueId && !targetOrganizationId) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  if (action !== "follow" && action !== "unfollow") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Ensure user has a profile (create if missing)
  await ensureUserProfile(user, serviceClient);

  try {
    if (action === "unfollow") {
      let query = serviceClient
        .from("follows")
        .delete()
        .eq("follower_id", user.id);

      if (targetUserId) {
        query = query.eq("followed_user_id", targetUserId);
      } else if (targetVenueId) {
        query = query.eq("followed_venue_id", parseInt(targetVenueId));
      } else if (targetOrganizationId) {
        query = query.eq("followed_organization_id", targetOrganizationId);
      }

      const { error } = await query;

      if (error) {
        logger.error("Unfollow error", error, { userId: user.id, targetUserId, targetVenueId, targetOrganizationId, component: "follow" });
        return NextResponse.json({ error: "Unable to unfollow" }, { status: 500 });
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

      const { error } = await serviceClient.from("follows").insert(followData as never);

      if (error) {
        // Check if it's a duplicate
        if (error.code === "23505") {
          return NextResponse.json({ success: true, isFollowing: true });
        }
        logger.error("Follow error", error, { userId: user.id, targetUserId, targetVenueId, targetOrganizationId, component: "follow" });
        return NextResponse.json({ error: "Unable to follow" }, { status: 500 });
      }

      return NextResponse.json({ success: true, isFollowing: true });
    }
  } catch (err) {
    logger.error("Follow action exception", err, { userId: user.id, component: "follow" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});
