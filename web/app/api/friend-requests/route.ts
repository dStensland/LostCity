import { NextResponse } from "next/server";
import { errorResponse, isValidUUID, isValidString, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";

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
    logger.error("friend-requests:GET unexpected error:", err);
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
    const { inviter_id, inviter_username, invitee_id } = body as {
      inviter_id?: string;
      inviter_username?: string;
      invitee_id?: string;
    };

    // Two flows:
    // 1. Invite link: inviter_id/inviter_username = the person who shared the link.
    //    Current user is the invitee (they clicked someone else's link).
    // 2. Direct request: invitee_id = the person being requested.
    //    Current user is the inviter (they clicked "Add Friend" on a profile).

    // Validate input
    if (inviter_id && !isValidUUID(inviter_id)) {
      return validationError("Invalid inviter_id format");
    }
    if (invitee_id && !isValidUUID(invitee_id)) {
      return validationError("Invalid invitee_id format");
    }
    if (inviter_username && !isValidString(inviter_username, 3, 30)) {
      return validationError("Invalid username format");
    }

    let finalInviterId: string;
    let finalInviteeId: string;

    if (invitee_id) {
      // Direct request flow: current user is the inviter
      finalInviterId = user.id;
      finalInviteeId = invitee_id;
    } else {
      // Invite link flow: resolve the inviter, current user is the invitee
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
          { error: "inviter_id, inviter_username, or invitee_id required" },
          { status: 400 }
        );
      }

      finalInviterId = resolvedInviterId;
      finalInviteeId = user.id;
    }

    const otherUserId = finalInviterId === user.id ? finalInviteeId : finalInviterId;

    // Can't send request to self
    if (otherUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot send friend request to yourself" },
        { status: 400 }
      );
    }

    // Check if already friends using the friendships table
    const { data: areFriends, error: friendCheckError } = await supabase.rpc(
      "are_friends" as never,
      { user_a: user.id, user_b: otherUserId } as never
    ) as { data: boolean | null; error: Error | null };

    if (friendCheckError) {
      logger.error("Error checking friendship:", friendCheckError);
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
        `and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`
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
        `and(inviter_id.eq.${user.id},invitee_id.eq.${otherUserId}),and(inviter_id.eq.${otherUserId},invitee_id.eq.${user.id})`
      )
      .maybeSingle();

    type ExistingRequestType = { id: string; status: string; inviter_id: string } | null;
    const existingReq = existingRequest as ExistingRequestType;

    if (existingReq) {
      // If there's a pending request FROM the other user to us, auto-accept it
      if (existingReq.inviter_id === otherUserId) {
        const { error: acceptError } = await serviceClient
          .from("friend_requests" as never)
          .update({ status: "accepted" } as never)
          .eq("id", existingReq.id);

        if (acceptError) {
          return errorResponse(acceptError, "friend-requests:POST:accept");
        }

        // Create the friendship record
        const { error: friendshipError } = await serviceClient.rpc(
          "create_friendship" as never,
          { user_a: user.id, user_b: otherUserId } as never
        );

        if (friendshipError) {
          logger.error("Error creating friendship on auto-accept:", { error: friendshipError.message });
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
    const { data: newRequest, error: insertError } = await serviceClient
      .from("friend_requests" as never)
      .insert({
        inviter_id: finalInviterId,
        invitee_id: finalInviteeId,
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
    logger.error("friend-requests:POST unexpected error:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
});
