import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-utils";

// GET /api/invites/[id] - Get a single invite
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from("event_invites")
    .select(`
      id,
      note,
      status,
      created_at,
      responded_at,
      inviter:profiles!event_invites_inviter_id_fkey (
        id, username, display_name, avatar_url
      ),
      invitee:profiles!event_invites_invitee_id_fkey (
        id, username, display_name, avatar_url
      ),
      event:events (
        id, title, start_date, start_time, is_all_day, image_url,
        venue:venues (id, name, neighborhood)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    return errorResponse(error, "invite");
  }

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({ invite });
}

// PATCH /api/invites/[id] - Update invite status (accept/decline/maybe)
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
  const { status } = body as { status: "accepted" | "declined" | "maybe" };

  if (!status || !["accepted", "declined", "maybe"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be: accepted, declined, or maybe" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Verify user is the invitee
  const { data: invite } = await supabase
    .from("event_invites")
    .select("id, invitee_id, status")
    .eq("id", id)
    .single();

  const inviteData = invite as { id: string; invitee_id: string; status: string } | null;

  if (!inviteData) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (inviteData.invitee_id !== user.id) {
    return NextResponse.json(
      { error: "You can only respond to invites sent to you" },
      { status: 403 }
    );
  }

  // Update the invite
  const { data: updatedInvite, error } = await supabase
    .from("event_invites")
    .update({
      status,
      responded_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return errorResponse(error, "invite");
  }

  return NextResponse.json({ invite: updatedInvite });
}

// DELETE /api/invites/[id] - Cancel/delete an invite (inviter only)
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

  // Verify user is the inviter
  const { data: invite } = await supabase
    .from("event_invites")
    .select("id, inviter_id")
    .eq("id", id)
    .single();

  const inviteData = invite as { id: string; inviter_id: string } | null;

  if (!inviteData) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (inviteData.inviter_id !== user.id) {
    return NextResponse.json(
      { error: "You can only cancel invites you sent" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("event_invites")
    .delete()
    .eq("id", id);

  if (error) {
    return errorResponse(error, "invite");
  }

  return NextResponse.json({ success: true });
}
