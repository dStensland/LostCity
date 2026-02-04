import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse, isValidUUID, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
};

// GET /api/friend-requests/[id] - Get a specific friend request
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting (auth tier - friend-related endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return validationError("Invalid request ID format");
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("friend_requests" as never)
      .select(`
        id,
        inviter_id,
        invitee_id,
        status,
        created_at,
        responded_at,
        inviter:profiles!friend_requests_inviter_id_fkey(
          id, username, display_name, avatar_url
        ),
        invitee:profiles!friend_requests_invitee_id_fkey(
          id, username, display_name, avatar_url
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("friend-requests:GET[id] error:", error);
      return errorResponse(error, "friend-requests:GET[id]");
    }

    if (!data) {
      return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
    }

    const friendRequest = data as FriendRequest & {
      inviter: unknown;
      invitee: unknown;
      created_at: string;
      responded_at: string | null;
    };

    // Only allow inviter or invitee to view
    if (friendRequest.inviter_id !== user.id && friendRequest.invitee_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to view this request" }, { status: 403 });
    }

    return NextResponse.json({ request: friendRequest });
  } catch (err) {
    console.error("friend-requests:GET[id] unexpected error:", err);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }
}

// PATCH /api/friend-requests/[id] - Accept or decline a friend request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting (auth tier - friend-related endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return validationError("Invalid request ID format");
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body as { action: "accept" | "decline" };

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the friend request
    const { data, error: fetchError } = await supabase
      .from("friend_requests" as never)
      .select("id, inviter_id, invitee_id, status")
      .eq("id", id)
      .maybeSingle();

    const friendRequest = data as FriendRequest | null;

    if (fetchError || !friendRequest) {
      console.error("friend-requests:PATCH fetch error:", fetchError);
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    // Only the invitee can accept/decline
    if (friendRequest.invitee_id !== user.id) {
      return NextResponse.json(
        { error: "You can only respond to requests sent to you" },
        { status: 403 }
      );
    }

    // Can only respond to pending requests
    if (friendRequest.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been responded to" },
        { status: 400 }
      );
    }

    // Update the request status
    const newStatus = action === "accept" ? "accepted" : "declined";
    const { error: updateError } = await supabase
      .from("friend_requests" as never)
      .update({ status: newStatus } as never)
      .eq("id", id);

    if (updateError) {
      return errorResponse(updateError, "friend-requests:PATCH");
    }

    // If accepted, create the friendship
    if (action === "accept") {
      const { error: friendshipError } = await supabase.rpc(
        "create_friendship" as never,
        { user_a: user.id, user_b: friendRequest.inviter_id } as never
      ) as { error: Error | null };

      if (friendshipError) {
        console.error("Error creating friendship:", friendshipError);
        // Don't fail the request - the status was already updated
        // The friendship can be created later if needed
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: action === "accept" ? "Friend request accepted" : "Friend request declined",
    });
  } catch (err) {
    console.error("friend-requests:PATCH unexpected error:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}

// DELETE /api/friend-requests/[id] - Cancel/delete a friend request
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting (auth tier - friend-related endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return validationError("Invalid request ID format");
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get the friend request to verify ownership
    const { data: data2, error: fetchError } = await supabase
      .from("friend_requests" as never)
      .select("id, inviter_id, invitee_id")
      .eq("id", id)
      .maybeSingle();

    const friendRequest = data2 as FriendRequest | null;

    if (fetchError || !friendRequest) {
      console.error("friend-requests:DELETE fetch error:", fetchError);
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    // Only the inviter or invitee can delete
    if (friendRequest.inviter_id !== user.id && friendRequest.invitee_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own friend requests" },
        { status: 403 }
      );
    }

    // Delete the request
    const { error: deleteError } = await supabase
      .from("friend_requests" as never)
      .delete()
      .eq("id", id);

    if (deleteError) {
      return errorResponse(deleteError, "friend-requests:DELETE");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("friend-requests:DELETE unexpected error:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
