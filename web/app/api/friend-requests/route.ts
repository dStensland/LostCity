import { NextResponse } from "next/server";
import { errorResponse, isValidUUID, isValidString, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuth } from "@/lib/api-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

// GET /api/friend-requests - Get user's friend requests
export const GET = withAuth(async (request, { user, supabase }) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all"; // received, sent, all

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
      return errorResponse(error, "friend-requests:GET");
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
  } catch (err) {
    console.error("friend-requests:GET unexpected error:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
});

// POST /api/friend-requests - Create a friend request
export const POST = withAuth(async (request, { user, supabase, serviceClient }) => {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const { inviter_id, inviter_username } = body as {
      inviter_id?: string;
      inviter_username?: string;
    };

    // Validate input
    if (inviter_id && !isValidUUID(inviter_id)) {
      return validationError("Invalid inviter_id format");
    }
    if (inviter_username && !isValidString(inviter_username, 3, 30)) {
      return validationError("Invalid username format");
    }

    // Resolve inviter_id from username if needed
    let resolvedInviterId = inviter_id;
    if (!resolvedInviterId && inviter_username) {
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", inviter_username.toLowerCase())
        .maybeSingle();

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

    // Check if already friends using the friendships table
    const { data: areFriends, error: friendCheckError } = await supabase.rpc(
      "are_friends" as never,
      { user_a: user.id, user_b: resolvedInviterId } as never
    ) as { data: boolean | null; error: Error | null };

    if (friendCheckError) {
      console.error("Error checking friendship:", friendCheckError);
      return NextResponse.json(
        { error: "Failed to check friendship status" },
        { status: 500 }
      );
    }

    if (areFriends) {
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
      .maybeSingle();

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
      .maybeSingle();

    type ExistingRequestType = { id: string; status: string; inviter_id: string } | null;
    const existingReq = existingRequest as ExistingRequestType;

    if (existingReq) {
      // If there's a pending request FROM the inviter to us, auto-accept it
      if (existingReq.inviter_id === resolvedInviterId) {
        const { error: acceptError } = await serviceClient
          .from("friend_requests" as never)
          .update({ status: "accepted" } as never)
          .eq("id", existingReq.id);

        if (acceptError) {
          return errorResponse(acceptError, "friend-requests:POST:accept");
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

    // Create the friend request using service client
    // The inviter is the person whose link was clicked
    // The invitee is the current user (who clicked the link)
    const { data: newRequest, error: insertError } = await serviceClient
      .from("friend_requests" as never)
      .insert({
        inviter_id: resolvedInviterId,
        invitee_id: user.id,
        status: "pending",
      } as never)
      .select()
      .maybeSingle();

    if (insertError) {
      return errorResponse(insertError, "friend-requests:POST:create");
    }

    return NextResponse.json({
      success: true,
      request: newRequest,
    });
  } catch (err) {
    console.error("friend-requests:POST unexpected error:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
});
