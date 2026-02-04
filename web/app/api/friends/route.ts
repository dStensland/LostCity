import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type GetFriendIdsResult = { friend_id: string }[];

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

// GET /api/friends - Get current user's friends from friendships table
export async function GET(request: Request) {
  // Apply rate limiting (auth tier - friend-related endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get friend IDs using the helper function
  const { data: friendIdsData, error: friendIdsError } = await supabase.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: GetFriendIdsResult | null; error: Error | null };

  if (friendIdsError) {
    console.error("Error fetching friend IDs:", friendIdsError);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }

  const friendIds = (friendIdsData || []).map((row) => row.friend_id);

  if (friendIds.length === 0) {
    return NextResponse.json({ friends: [], count: 0 });
  }

  // Fetch profiles for friends
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
