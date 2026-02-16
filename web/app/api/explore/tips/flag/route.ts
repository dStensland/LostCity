import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidEnum, isValidUUID } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";

const FLAG_REASONS = ["spam", "offensive", "irrelevant", "other"] as const;
type FlagReason = typeof FLAG_REASONS[number];

/**
 * POST /api/explore/tips/flag
 * Flag a tip
 * Body: { tipId: string, reason: 'spam'|'offensive'|'irrelevant'|'other' }
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  // Check body size
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { tipId, reason } = body;

    // Validate input
    if (!isValidUUID(tipId)) {
      return validationError("Invalid tipId. Must be a valid UUID");
    }

    if (!isValidEnum<FlagReason>(reason, FLAG_REASONS)) {
      return validationError("Invalid reason. Must be one of: spam, offensive, irrelevant, other");
    }

    // Ensure profile exists
    await ensureUserProfile(user, serviceClient);

    // Verify tip exists
    const { data: tip } = await serviceClient
      .from("explore_tips")
      .select("id")
      .eq("id", tipId)
      .maybeSingle();

    if (!tip) {
      return NextResponse.json({ error: "Tip not found" }, { status: 404 });
    }

    // Check if user already flagged this tip
    const { data: existingFlag } = await serviceClient
      .from("explore_flags")
      .select("id")
      .eq("tip_id", tipId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingFlag) {
      return NextResponse.json(
        { error: "You have already flagged this tip" },
        { status: 409 }
      );
    }

    // Insert flag (trigger will auto-increment flag_count and potentially change status to flagged)
    const { error: insertError } = await serviceClient
      .from("explore_flags")
      .insert({
        tip_id: tipId,
        user_id: user.id,
        reason,
      } as never);

    if (insertError) {
      // Handle race condition where another request flagged simultaneously
      if (insertError.code === "23505") {
        return NextResponse.json({
          success: true,
          message: "Tip already flagged by you",
        });
      }
      console.error("Flag insert error:", insertError);
      return NextResponse.json({ error: "Failed to flag tip" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Tip flagged successfully",
    });
  } catch (error) {
    console.error("Flag tip API error:", error);
    return NextResponse.json({ error: "Failed to flag tip" }, { status: 500 });
  }
});
