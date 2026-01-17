import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser, isAdmin } from "@/lib/supabase/server";

// Create admin client with service role for auth operations
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase admin credentials");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
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

// GET /api/admin/users - Get users with auth info
export async function GET(request: Request) {
  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id");

  const adminClient = createAdminClient();

  if (userId) {
    // Get single user with auth data
    const { data: authUser, error } = await adminClient.auth.admin.getUserById(userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: authUser });
  }

  // List all users
  const { data, error } = await adminClient.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data.users });
}
