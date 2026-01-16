import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
};

// PATCH /api/friend-requests/[id] - Accept or decline a friend request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    .single();

  const friendRequest = data as FriendRequest | null;

  if (fetchError || !friendRequest) {
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
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    message: action === "accept" ? "Friend request accepted" : "Friend request declined",
  });
}

// DELETE /api/friend-requests/[id] - Cancel/delete a friend request
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    .single();

  const friendRequest = data2 as FriendRequest | null;

  if (fetchError || !friendRequest) {
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
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
