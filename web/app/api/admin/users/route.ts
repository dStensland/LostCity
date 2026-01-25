import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser, isAdmin } from "@/lib/supabase/server";

// Create admin client with service role for auth operations
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(`Missing Supabase admin credentials: url=${!!url}, key=${!!key}`);
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// PATCH /api/admin/users - Update a user's profile
export async function PATCH(request: Request) {
  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, updates } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/users - Delete a user
export async function DELETE(request: Request) {
  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  // Don't allow deleting yourself
  const currentUser = await getUser();
  if (currentUser?.id === userId) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Delete user from auth (cascades to profile via FK)
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET /api/admin/users - Get users with profile and auth info
export async function GET(request: Request) {
  try {
    // Verify admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");
    const search = searchParams.get("search");

    const adminClient = createAdminClient();

    if (userId) {
      // Get single user with auth data, profile, and stats
      const [authResult, profileResult, followerCount, followingCount, rsvpCount] = await Promise.all([
        adminClient.auth.admin.getUserById(userId),
        adminClient.from("profiles").select("*").eq("id", userId).single(),
        adminClient.from("follows").select("*", { count: "exact", head: true }).eq("followed_user_id", userId),
        adminClient.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        adminClient.from("event_rsvps").select("*", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      if (authResult.error) {
        return NextResponse.json({ error: authResult.error.message }, { status: 500 });
      }

      return NextResponse.json({
        user: {
          ...profileResult.data,
          email: authResult.data.user?.email,
          auth: authResult.data.user,
          follower_count: followerCount.count || 0,
          following_count: followingCount.count || 0,
          rsvp_count: rsvpCount.count || 0,
        },
      });
    }

    // List all profiles with optional search
    let query = adminClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    return NextResponse.json({ users: profiles || [] });
  } catch (error) {
    console.error("Admin users API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}
