import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuth } from "@/lib/api-middleware";

// GET /api/invites - Get user's invites
export const GET = withAuth(async (request, { user, supabase }) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "received"; // received, sent, all
  const status = searchParams.get("status"); // pending, accepted, declined, maybe

  let query = supabase
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
    .order("created_at", { ascending: false });

  // Filter by type
  if (type === "received") {
    query = query.eq("invitee_id", user.id);
  } else if (type === "sent") {
    query = query.eq("inviter_id", user.id);
  } else {
    query = query.or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`);
  }

  // Filter by status
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse(error, "invites");
  }

  // Get counts
  const { count: pendingCount } = await supabase
    .from("event_invites")
    .select("*", { count: "exact", head: true })
    .eq("invitee_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({
    invites: data || [],
    pendingCount: pendingCount || 0,
  });
});

// POST /api/invites - Create a new invite
export const POST = withAuth(async (request, { user, supabase, serviceClient }) => {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const { eventId, inviteeId, note } = body as {
    eventId: number;
    inviteeId: string;
    note?: string;
  };

  if (!eventId || !inviteeId) {
    return NextResponse.json(
      { error: "eventId and inviteeId are required" },
      { status: 400 }
    );
  }

  // Can't invite yourself
  if (inviteeId === user.id) {
    return NextResponse.json(
      { error: "You can't invite yourself" },
      { status: 400 }
    );
  }

  // Check if event exists
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Check if invitee exists
  const { data: invitee } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", inviteeId)
    .maybeSingle();

  if (!invitee) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if invite already exists
  const { data: existingInvite } = await supabase
    .from("event_invites")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("inviter_id", user.id)
    .eq("invitee_id", inviteeId)
    .maybeSingle();

  if (existingInvite) {
    return NextResponse.json(
      { error: "You've already invited this person to this event" },
      { status: 400 }
    );
  }

  // Create invite using service client
  const { data: invite, error } = await serviceClient
    .from("event_invites")
    .insert({
      event_id: eventId,
      inviter_id: user.id,
      invitee_id: inviteeId,
      note: note || null,
    } as never)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(error, "invite");
  }

  return NextResponse.json({ invite }, { status: 201 });
});
