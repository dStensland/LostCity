import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

// GET /api/friend-requests - Get user's friend requests
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all"; // received, sent, all

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  let query: AnyQuery = supabase
    .from("friend_requests" as never)
    .select(`
      id,
      inviter_id,
      invitee_id,
      status,
      created_at,
      responded_at,
      inviter:profiles!friend_requests_inviter_id_fkey(
        id, username, display_name, avatar_url, bio
      ),
      invitee:profiles!friend_requests_invitee_id_fkey(
        id, username, display_name, avatar_url, bio
      )
    `)
    .order("created_at", { ascending: false });

  if (type === "received") {
    query = query.eq("invitee_id", user.id);
  } else if (type === "sent") {
    query = query.eq("inviter_id", user.id);
  } else {
    query = query.or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get pending count (received only)
  const { count: pendingCount } = await supabase
    .from("friend_requests" as never)
    .select("*", { count: "exact", head: true })
    .eq("invitee_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({
    requests: data || [],
    pendingCount: pendingCount || 0,
  });
}

// POST /api/friend-requests - Create a friend request
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { inviter_id, inviter_username } = body as {
    inviter_id?: string;
    inviter_username?: string;
  };

  const supabase = await createClient();

  // Resolve inviter_id from username if needed
  let resolvedInviterId = inviter_id;
  if (!resolvedInviterId && inviter_username) {
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", inviter_username.toLowerCase())
      .single();

    if (!inviterProfile) {
      return NextResponse.json({ error: "Inviter not found" }, { status: 404 });
    }
    resolvedInviterId = (inviterProfile as { id: string }).id;
  }

  if (!resolvedInviterId) {
    return NextResponse.json(
      { error: "inviter_id or inviter_username required" },
      { status: 400 }
    );
  }

  // Can't send request to self
  if (resolvedInviterId === user.id) {
    return NextResponse.json(
      { error: "Cannot send friend request to yourself" },
      { status: 400 }
    );
  }

  // Check if already friends (mutual follows)
  const { data: follows } = await supabase
    .from("follows")
    .select("id, follower_id, followed_user_id")
    .or(
      `and(follower_id.eq.${user.id},followed_user_id.eq.${resolvedInviterId}),and(follower_id.eq.${resolvedInviterId},followed_user_id.eq.${user.id})`
    );

  type FollowRow = { follower_id: string; followed_user_id: string };
  const followsData = follows as FollowRow[] | null;
  const userFollowsInviter = followsData?.some(
    (f) => f.follower_id === user.id && f.followed_user_id === resolvedInviterId
  );
  const inviterFollowsUser = followsData?.some(
    (f) => f.follower_id === resolvedInviterId && f.followed_user_id === user.id
  );

  if (userFollowsInviter && inviterFollowsUser) {
    return NextResponse.json(
      { error: "You are already friends" },
      { status: 400 }
    );
  }

  // Check if blocked
  const { data: block } = await supabase
    .from("user_blocks" as never)
    .select("id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${resolvedInviterId}),and(blocker_id.eq.${resolvedInviterId},blocked_id.eq.${user.id})`
    )
    .single();

  if (block) {
    return NextResponse.json(
      { error: "Unable to send friend request" },
      { status: 400 }
    );
  }

  // Check for existing pending request in either direction
  const { data: existingRequest } = await supabase
    .from("friend_requests" as never)
    .select("id, status, inviter_id")
    .eq("status", "pending")
    .or(
      `and(inviter_id.eq.${user.id},invitee_id.eq.${resolvedInviterId}),and(inviter_id.eq.${resolvedInviterId},invitee_id.eq.${user.id})`
    )
    .single();

  type ExistingRequestType = { id: string; status: string; inviter_id: string } | null;
  const existingReq = existingRequest as ExistingRequestType;

  if (existingReq) {
    // If there's a pending request FROM the inviter to us, auto-accept it
    if (existingReq.inviter_id === resolvedInviterId) {
      const { error: acceptError } = await supabase
        .from("friend_requests" as never)
        .update({ status: "accepted" } as never)
        .eq("id", existingReq.id);

      if (acceptError) {
        return NextResponse.json({ error: acceptError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Friend request accepted - you are now friends",
        accepted: true,
      });
    }

    return NextResponse.json(
      { error: "Friend request already pending" },
      { status: 400 }
    );
  }

  // Create the friend request
  // The inviter is the person whose link was clicked
  // The invitee is the current user (who clicked the link)
  const { data: newRequest, error: insertError } = await supabase
    .from("friend_requests" as never)
    .insert({
      inviter_id: resolvedInviterId,
      invitee_id: user.id,
      status: "pending",
    } as never)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    request: newRequest,
  });
}
