import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { validationError, isValidUUID } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/curations/[id]/follow
 * Check if the current user follows this curation
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: listId } = await params;

  if (!isValidUUID(listId)) {
    return validationError("Invalid curation ID");
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ following: false, follower_count: 0 });
    }

    const { data: follow } = await supabase
      .from("curation_follows")
      .select("id")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      following: !!follow,
    });
  } catch (error) {
    console.error("Curation follow GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/curations/[id]/follow
 * Toggle follow/unfollow on a curation
 */
export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      // Verify curation exists and is public
      const { data: list } = await serviceClient
        .from("lists")
        .select("id, is_public, status, follower_count")
        .eq("id", listId)
        .eq("status", "active")
        .eq("is_public", true)
        .maybeSingle();

      if (!list) {
        return NextResponse.json({ error: "Curation not found" }, { status: 404 });
      }

      // Check if already following
      const { data: existing } = await serviceClient
        .from("curation_follows")
        .select("id")
        .eq("list_id", listId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Unfollow
        await serviceClient
          .from("curation_follows")
          .delete()
          .eq("list_id", listId)
          .eq("user_id", user.id);

        // Trigger will update follower_count; fetch fresh count
        const { data: updated } = await serviceClient
          .from("lists")
          .select("follower_count")
          .eq("id", listId)
          .maybeSingle();

        return NextResponse.json({
          following: false,
          follower_count: updated?.follower_count ?? 0,
        });
      } else {
        // Follow
        const { error } = await serviceClient
          .from("curation_follows")
          .insert({
            list_id: listId,
            user_id: user.id,
          } as never);

        if (error) {
          console.error("Curation follow insert error:", error);
          return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
        }

        // Trigger will update follower_count; fetch fresh count
        const { data: updated } = await serviceClient
          .from("lists")
          .select("follower_count")
          .eq("id", listId)
          .maybeSingle();

        return NextResponse.json({
          following: true,
          follower_count: updated?.follower_count ?? 0,
        });
      }
    } catch (error) {
      console.error("Curation follow POST error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);
