import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type RelationshipStatus =
  | "none"
  | "friends"
  | "following"
  | "followed_by"
  | "request_sent"
  | "request_received";

type FriendshipRow = { user_a_id: string; user_b_id: string };
type FollowRow = { follower_id: string; followed_user_id: string };
type FriendRequestRow = { inviter_id: string; invitee_id: string };

/**
 * POST /api/relationships/batch
 *
 * Efficiently fetch relationship statuses for multiple users in a single call.
 *
 * Request body:
 * {
 *   userIds: string[]  // Array of user IDs to check relationships for
 * }
 *
 * Response:
 * {
 *   relationships: Record<userId, RelationshipStatus>
 * }
 *
 * RelationshipStatus hierarchy (in priority order):
 * 1. "friends" - Mutual friendship exists in friendships table
 * 2. "request_sent" - Current user sent a pending friend request
 * 3. "request_received" - Current user received a pending friend request
 * 4. "following" - Current user follows the target user
 * 5. "followed_by" - Target user follows current user
 * 6. "none" - No relationship exists
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const { userIds } = body as { userIds?: unknown };

    // Validate userIds is an array
    if (!Array.isArray(userIds)) {
      return NextResponse.json(
        { error: "userIds must be an array" },
        { status: 400 }
      );
    }

    // Handle empty array - return empty object
    if (userIds.length === 0) {
      return NextResponse.json({ relationships: {} });
    }

    // Validate max batch size (prevent abuse)
    const MAX_BATCH_SIZE = 100;
    if (userIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} user IDs allowed per request` },
        { status: 400 }
      );
    }

    // Validate each ID is a string and looks like a UUID
    const validUserIds: string[] = [];
    for (const id of userIds) {
      if (typeof id !== "string" || id.trim() === "") {
        continue; // Skip invalid IDs silently
      }

      // Basic UUID format validation (36 chars with hyphens)
      const trimmedId = id.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId)) {
        validUserIds.push(trimmedId);
      }
    }

    // Remove duplicates and current user's ID
    const uniqueUserIds = Array.from(new Set(validUserIds)).filter(id => id !== user.id);

    // If no valid IDs after filtering, return empty object
    if (uniqueUserIds.length === 0) {
      return NextResponse.json({ relationships: {} });
    }

    // 3. Initialize relationships map with "none" as default
    const relationships: Record<string, RelationshipStatus> = {};
    uniqueUserIds.forEach(id => {
      relationships[id] = "none";
    });

    // 4. Fetch friendships in a single query
    // The friendships table uses canonical ordering (user_a_id < user_b_id)
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_a_id, user_b_id")
      .or(
        `user_a_id.eq.${user.id},user_b_id.eq.${user.id}`
      );

    const friendshipsData = (friendships as FriendshipRow[] | null) || [];

    // Mark friends
    friendshipsData.forEach(f => {
      const friendId = f.user_a_id === user.id ? f.user_b_id : f.user_a_id;
      if (relationships[friendId] !== undefined) {
        relationships[friendId] = "friends";
      }
    });

    // 5. Fetch follows in a single query
    // Build OR condition for all user pairs
    const followConditions = uniqueUserIds
      .map(
        targetId =>
          `and(follower_id.eq.${user.id},followed_user_id.eq.${targetId}),and(follower_id.eq.${targetId},followed_user_id.eq.${user.id})`
      )
      .join(",");

    const { data: follows } = await supabase
      .from("follows")
      .select("follower_id, followed_user_id")
      .or(followConditions);

    const followsData = (follows as FollowRow[] | null) || [];

    // Track following/followed_by (only update if not already friends)
    followsData.forEach(f => {
      if (f.follower_id === user.id) {
        const targetId = f.followed_user_id;
        if (relationships[targetId] === "none") {
          relationships[targetId] = "following";
        }
      } else if (f.followed_user_id === user.id) {
        const targetId = f.follower_id;
        if (relationships[targetId] === "none") {
          relationships[targetId] = "followed_by";
        }
      }
    });

    // 6. Fetch pending friend requests in a single query
    const requestConditions = uniqueUserIds
      .map(
        targetId =>
          `and(inviter_id.eq.${user.id},invitee_id.eq.${targetId}),and(inviter_id.eq.${targetId},invitee_id.eq.${user.id})`
      )
      .join(",");

    const { data: requests } = await supabase
      .from("friend_requests" as never)
      .select("inviter_id, invitee_id")
      .eq("status", "pending")
      .or(requestConditions);

    const requestsData = (requests as FriendRequestRow[] | null) || [];

    // Update relationships based on pending requests (highest priority after friends)
    requestsData.forEach(req => {
      if (req.inviter_id === user.id) {
        const targetId = req.invitee_id;
        if (relationships[targetId] !== "friends") {
          relationships[targetId] = "request_sent";
        }
      } else if (req.invitee_id === user.id) {
        const targetId = req.inviter_id;
        if (relationships[targetId] !== "friends") {
          relationships[targetId] = "request_received";
        }
      }
    });

    // 7. Return the relationships map
    return NextResponse.json({ relationships });

  } catch (err) {
    console.error("relationships/batch:POST unexpected error:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
