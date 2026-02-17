import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidUUID } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";

/**
 * POST /api/best-of/[slug]/vote
 * Cast or switch vote for a venue in a category
 * Body: { categoryId: string, venueId: number }
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    user.id
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { categoryId, venueId } = body;

    if (!isValidUUID(categoryId)) {
      return validationError("Invalid categoryId");
    }
    if (!venueId || typeof venueId !== "number" || !Number.isInteger(venueId) || venueId <= 0) {
      return validationError("Invalid venueId");
    }

    await ensureUserProfile(user, serviceClient);

    // Parallel validation: category + venue + nomination + existing vote
    const [{ data: category }, { data: venue }, { data: nomination }, { data: existingVote }] = await Promise.all([
      serviceClient
        .from("best_of_categories")
        .select("id, portal_id")
        .eq("id", categoryId)
        .eq("is_active", true)
        .maybeSingle(),
      serviceClient
        .from("venues")
        .select("id, city")
        .eq("id", venueId)
        .maybeSingle(),
      serviceClient
        .from("best_of_nominations")
        .select("id")
        .eq("category_id", categoryId)
        .eq("venue_id", venueId)
        .eq("status", "approved")
        .maybeSingle(),
      serviceClient
        .from("best_of_votes")
        .select("id, venue_id")
        .eq("user_id", user.id)
        .eq("category_id", categoryId)
        .maybeSingle(),
    ]);

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    if (!nomination) {
      return NextResponse.json({ error: "Venue not nominated for this category" }, { status: 400 });
    }

    if (existingVote) {
      const existing = existingVote as unknown as { id: string; venue_id: number };
      if (existing.venue_id === venueId) {
        // Same venue — retract vote
        await serviceClient
          .from("best_of_votes")
          .delete()
          .eq("id", existing.id);

        return NextResponse.json({ success: true, voted: false, venueId: null });
      } else {
        // Different venue — switch vote
        const { error: updateError } = await serviceClient
          .from("best_of_votes")
          .update({ venue_id: venueId } as never)
          .eq("id", existing.id);

        if (updateError) {
          console.error("Vote switch error:", updateError);
          return NextResponse.json({ error: "Failed to switch vote" }, { status: 500 });
        }

        return NextResponse.json({ success: true, voted: true, venueId });
      }
    } else {
      // New vote
      const { error: insertError } = await serviceClient
        .from("best_of_votes")
        .insert({
          user_id: user.id,
          category_id: categoryId,
          venue_id: venueId,
        } as never);

      if (insertError) {
        if (insertError.code === "23505") {
          return NextResponse.json({ success: true, voted: true, venueId });
        }
        console.error("Vote insert error:", insertError);
        return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
      }

      return NextResponse.json({ success: true, voted: true, venueId });
    }
  } catch (error) {
    console.error("Vote API error:", error);
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500 });
  }
});

/**
 * DELETE /api/best-of/[slug]/vote
 * Retract vote for a category
 * Body: { categoryId: string }
 */
export const DELETE = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    user.id
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { categoryId } = body;

    if (!isValidUUID(categoryId)) {
      return validationError("Invalid categoryId");
    }

    const { error } = await serviceClient
      .from("best_of_votes")
      .delete()
      .eq("user_id", user.id)
      .eq("category_id", categoryId);

    if (error) {
      console.error("Vote delete error:", error);
      return NextResponse.json({ error: "Failed to retract vote" }, { status: 500 });
    }

    return NextResponse.json({ success: true, voted: false, venueId: null });
  } catch (error) {
    console.error("Vote delete API error:", error);
    return NextResponse.json({ error: "Failed to retract vote" }, { status: 500 });
  }
});
