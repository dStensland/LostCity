import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import type { AnySupabase } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

// GET /api/users/me/lists - Get current user's lists with item membership info
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient() as AnySupabase;

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const itemType = searchParams.get("item_type");
    const itemId = searchParams.get("item_id");

    // Fetch user's lists
    const { data: lists, error } = await supabase
      .from("lists")
      .select("id, title, slug, category, is_public, created_at, updated_at")
      .eq("creator_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (error) {
      logger.error("Error fetching user lists:", error);
      return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
    }

    // If item type and ID provided, check which lists contain this item
    if (itemType && itemId) {
      const listIds = (lists || []).map((list: { id: string }) => list.id);

      if (listIds.length > 0) {
        let query = supabase
          .from("list_items")
          .select("list_id")
          .in("list_id", listIds)
          .eq("item_type", itemType);

        // Filter by the appropriate ID field based on item type
        if (itemType === "venue") {
          query = query.eq("venue_id", parseInt(itemId));
        } else if (itemType === "event") {
          query = query.eq("event_id", parseInt(itemId));
        } else if (itemType === "organization") {
          query = query.eq("organization_id", parseInt(itemId));
        }

        const { data: itemMembership } = await query;

        // Create a set of list IDs that contain this item
        const containsItem = new Set(
          (itemMembership || []).map((item: { list_id: string }) => item.list_id)
        );

        // Add contains_item flag to each list
        const listsWithMembership = (lists || []).map((list: { id: string }) => ({
          ...list,
          contains_item: containsItem.has(list.id),
        }));

        return NextResponse.json({
          lists: listsWithMembership,
        });
      }
    }

    return NextResponse.json({
      lists: lists || [],
    });
  } catch (error) {
    logger.error("Error in user lists GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
