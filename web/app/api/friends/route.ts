import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

// GET /api/friends - Get current user's friends (mutual follows)
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Friends are users with mutual follows
  // Step 1: Get users I follow
  const { data: following } = await supabase
    .from("follows")
    .select("followed_user_id")
    .eq("follower_id", user.id)
    .not("followed_user_id", "is", null);

  const followingIds = (following || [])
    .map((f) => (f as { followed_user_id: string }).followed_user_id)
    .filter(Boolean);

  if (followingIds.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Step 2: Get users who follow me back (from the list I follow)
  const { data: mutualFollows } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followed_user_id", user.id)
    .in("follower_id", followingIds);

  const friendIds = (mutualFollows || [])
    .map((f) => (f as { follower_id: string }).follower_id)
    .filter(Boolean);

  if (friendIds.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Step 3: Fetch profiles for friends
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .in("id", friendIds)
    .order("display_name");

  if (error) {
    console.error("Error fetching friend profiles:", error);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }

  return NextResponse.json({
    friends: (profiles || []) as Profile[],
    count: (profiles || []).length,
  });
}
