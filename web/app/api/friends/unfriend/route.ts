import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { isValidUUID, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// POST /api/friends/unfriend - Remove a friendship
export async function POST(request: Request) {
  // Apply rate limiting (auth tier - friend-related endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetUserId } = body as { targetUserId?: string };

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(targetUserId)) {
      return validationError("Invalid targetUserId format");
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot unfriend yourself" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Use the delete_friendship helper function to handle canonical ordering
    const { data, error } = await supabase.rpc(
      "delete_friendship" as never,
      { user_a: user.id, user_b: targetUserId } as never
    ) as { data: boolean | null; error: Error | null };

    if (error) {
      logger.error("Unfriend error:", error);
      return NextResponse.json(
        { error: "Failed to remove friendship" },
        { status: 500 }
      );
    }

    // data is true if a friendship was deleted, false if none existed
    return NextResponse.json({
      success: true,
      deleted: data === true,
    });
  } catch (err) {
    logger.error("Unfriend unexpected error:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
