import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

// GET /api/users/search?q=searchterm&limit=20
// Search for users by username or display name
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [], message: "Search query must be at least 2 characters" });
  }

  const supabase = await createClient();
  const currentUser = await getUser();

  // Search for users - only public profiles
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .eq("is_public", true)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order("display_name")
    .limit(limit);

  if (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }

  // Filter out current user if logged in
  let users = (profiles || []) as Profile[];
  if (currentUser) {
    users = users.filter((u) => u.id !== currentUser.id);
  }

  return NextResponse.json({
    users,
    count: users.length,
  });
}
