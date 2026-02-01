import { NextResponse } from "next/server";
import { createClient as createServerClient, getUser, isAdmin } from "@/lib/supabase/server";
import { escapeSQLPattern } from "@/lib/api-utils";

// Username validation: lowercase alphanumeric + underscore, 3-30 chars
const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username) {
    return { valid: false, error: "Username is required" };
  }
  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }
  if (username.length > 30) {
    return { valid: false, error: "Username must be 30 characters or less" };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, error: "Username can only contain lowercase letters, numbers, and underscores" };
  }
  return { valid: true };
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Whitelist allowed fields for admin updates
    const allowedFields = ['username', 'display_name', 'bio', 'location', 'website', 'is_active', 'avatar_url'];
    const safeUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = value;
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // If username is being updated, validate it
    if (safeUpdates.username !== undefined) {
      const validation = validateUsername(safeUpdates.username as string);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Check if username is already taken by another user
      const { data: existingUser } = await sb
        .from("profiles")
        .select("id")
        .eq("username", safeUpdates.username)
        .neq("id", userId)
        .maybeSingle();

      if (existingUser) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 400 });
      }
    }

    const { error } = await sb
      .from("profiles")
      .update(safeUpdates as never)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [profileResult, followerCount, followingCount, rsvpCount] = await Promise.all([
        sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
        sb.from("follows").select("*", { count: "exact", head: true }).eq("followed_user_id", userId),
        sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        sb.from("event_rsvps").select("*", { count: "exact", head: true }).eq("user_id", userId),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) {
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = escapeSQLPattern(search);
      query = query.or(`username.ilike.%${sanitizedSearch}%,display_name.ilike.%${sanitizedSearch}%`);
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
