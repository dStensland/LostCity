import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/api-utils";

type ProfileData = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_public: boolean;
};

type FollowRow = { follower_id: string; followed_user_id: string };
type FriendRequestRow = { id: string; inviter_id: string; invitee_id: string; status: string };

type RelationshipStatus =
  | "none"
  | "friends"
  | "following"
  | "followed_by"
  | "request_sent"
  | "request_received";

// GET /api/users/[username] - Get public profile by username
// Note: Uses manual optional auth (not withOptionalAuth) due to params handling
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { username } = await params;

  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const supabase = await createClient();

  // Optional auth - don't return 401 if not authenticated
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Fetch the profile
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, location, is_public")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  const profile = data as ProfileData | null;

  if (error || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if profile is public or belongs to current user
  if (!profile.is_public && profile.id !== currentUser?.id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // If current user is logged in, check relationship status
  let relationship: RelationshipStatus | null = null;
  let isFollowing = false;
  let isFollowedBy = false;

  if (currentUser && currentUser.id !== profile.id) {
    // Check if they're friends using the friendships table
    const { data: areFriends } = await supabase.rpc(
      "are_friends" as never,
      { user_a: currentUser.id, user_b: profile.id } as never
    ) as { data: boolean | null };

    if (areFriends) {
      relationship = "friends";
    }

    // Check follow status (separate from friendship)
    // Validate UUIDs before interpolation to prevent injection
    if (!isValidUUID(currentUser.id) || !isValidUUID(profile.id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }
    const { data: follows } = await supabase
      .from("follows")
      .select("follower_id, followed_user_id")
      .or(
        `and(follower_id.eq.${currentUser.id},followed_user_id.eq.${profile.id}),and(follower_id.eq.${profile.id},followed_user_id.eq.${currentUser.id})`
      );

    const followsData = follows as FollowRow[] | null;
    isFollowing = followsData?.some(
      (f) => f.follower_id === currentUser.id && f.followed_user_id === profile.id
    ) ?? false;
    isFollowedBy = followsData?.some(
      (f) => f.follower_id === profile.id && f.followed_user_id === currentUser.id
    ) ?? false;

    // If not friends, determine relationship based on follows and friend requests
    if (!relationship) {
      // Check for pending friend request first
      // UUIDs already validated above
      const { data: pendingRequest } = await supabase
        .from("friend_requests" as never)
        .select("id, inviter_id, invitee_id, status")
        .eq("status", "pending")
        .or(
          `and(inviter_id.eq.${currentUser.id},invitee_id.eq.${profile.id}),and(inviter_id.eq.${profile.id},invitee_id.eq.${currentUser.id})`
        )
        .maybeSingle();

      const pendingReq = pendingRequest as FriendRequestRow | null;

      if (pendingReq) {
        if (pendingReq.inviter_id === currentUser.id) {
          relationship = "request_sent";
        } else {
          relationship = "request_received";
        }
      } else if (isFollowing) {
        relationship = "following";
      } else if (isFollowedBy) {
        relationship = "followed_by";
      } else {
        relationship = "none";
      }
    }
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      location: profile.location,
    },
    relationship,
    isFollowing,
    isFollowedBy,
  });
}
