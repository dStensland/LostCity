import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

// GET /api/notifications - Get user's notifications
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const unreadOnly = searchParams.get("unread") === "true";

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select(`
      id,
      type,
      message,
      read_at,
      created_at,
      actor:profiles!notifications_actor_id_fkey(
        id, username, display_name, avatar_url
      ),
      event:events(id, title),
      venue:venues(id, name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get unread count
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return NextResponse.json({
    notifications: data || [],
    unreadCount: unreadCount || 0,
  });
}

// POST /api/notifications - Mark notifications as read
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { notificationIds, markAllRead } = body as {
    notificationIds?: string[];
    markAllRead?: boolean;
  };

  const supabase = await createClient();

  if (markAllRead) {
    // Mark all unread notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (notificationIds && notificationIds.length > 0) {
    // Mark specific notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("user_id", user.id)
      .in("id", notificationIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
