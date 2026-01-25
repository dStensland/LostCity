import { NextResponse } from "next/server";
import { createClient as createServerClient, getUser, isAdmin } from "@/lib/supabase/server";

// PATCH /api/admin/users - Update a user's profile
export async function PATCH(request: Request) {
  try {
    // Verify admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { userId, updates } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const supabase = await createServerClient();

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin users PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users - Delete a user (soft delete by deactivating)
export async function DELETE(request: Request) {
  try {
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

    // Soft delete - deactivate the profile
    // Full deletion requires service key which isn't available
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin users DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}

// GET /api/admin/users - Get users with profile info
export async function GET(request: Request) {
  try {
    // Verify admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");
    const search = searchParams.get("search");

    const supabase = await createServerClient();

    if (userId) {
      // Get single user with profile and stats
      const [profileResult, followerCount, followingCount, rsvpCount] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("followed_user_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("event_rsvps").select("*", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      if (profileResult.error) {
        return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
      }

      return NextResponse.json({
        user: {
          ...profileResult.data,
          follower_count: followerCount.count || 0,
          following_count: followingCount.count || 0,
          rsvp_count: rsvpCount.count || 0,
        },
      });
    }

    // List all profiles with optional search
    // Note: Requires RLS policy allowing admins to read all profiles
    let query = supabase
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
