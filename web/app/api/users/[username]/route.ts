import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

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

// GET /api/users/[username] - Get public profile by username
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const supabase = await createClient();
  const currentUser = await getUser();

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
  let relationship = null;
  if (currentUser && currentUser.id !== profile.id) {
    // Check if they're friends (mutual follows)
    const { data: follows } = await supabase
      .from("follows")
      .select("id, follower_id, followed_user_id")
      .or(
        `and(follower_id.eq.${currentUser.id},followed_user_id.eq.${profile.id}),and(follower_id.eq.${profile.id},followed_user_id.eq.${currentUser.id})`
      );

    const followsData = follows as FollowRow[] | null;
    const currentFollowsProfile = followsData?.some(
      (f) => f.follower_id === currentUser.id && f.followed_user_id === profile.id
    );
    const profileFollowsCurrent = followsData?.some(
      (f) => f.follower_id === profile.id && f.followed_user_id === currentUser.id
    );

    if (currentFollowsProfile && profileFollowsCurrent) {
      relationship = "friends";
    } else if (currentFollowsProfile) {
      relationship = "following";
    } else if (profileFollowsCurrent) {
      relationship = "followed_by";
    }

    // Check for pending friend request
    if (!relationship || relationship === "following" || relationship === "followed_by") {
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
  });
}
