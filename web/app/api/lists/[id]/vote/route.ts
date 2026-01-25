import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Type helper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/lists/[id]/vote - Vote on a list or item
export async function POST(request: NextRequest, context: RouteContext) {
  const supabase = await createClient() as AnySupabase;
  const { id: listId } = await context.params;

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { item_id, vote_type } = body;

    // Validate vote type
    if (vote_type && !["up", "down"].includes(vote_type)) {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 });
    }

    // Check if list exists and is public
    const { data: list } = await supabase
      .from("lists")
      .select("id, is_public")
      .eq("id", listId)
      .eq("status", "active")
      .single();

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (!list.is_public) {
      return NextResponse.json({ error: "Cannot vote on private lists" }, { status: 403 });
    }

    // If item_id provided, verify it belongs to this list
    if (item_id) {
      const { data: item } = await supabase
        .from("list_items")
        .select("id")
        .eq("id", item_id)
        .eq("list_id", listId)
        .single();

      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
    }

    // Check for existing vote
    const { data: existingVote } = await supabase
      .from("list_votes")
      .select("id, vote_type")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .is("item_id", item_id || null)
      .single();

    if (existingVote) {
      if (!vote_type || existingVote.vote_type === vote_type) {
        // Remove vote if same type or no type specified (toggle off)
        await supabase
          .from("list_votes")
          .delete()
          .eq("id", existingVote.id);

        return NextResponse.json({ vote: null, action: "removed" });
      } else {
        // Update vote type
        const { data: vote } = await supabase
          .from("list_votes")
          .update({ vote_type })
          .eq("id", existingVote.id)
          .select()
          .single();

        return NextResponse.json({ vote, action: "updated" });
      }
    } else {
      // Create new vote
      const { data: vote, error } = await supabase
        .from("list_votes")
        .insert({
          list_id: listId,
          item_id: item_id || null,
          user_id: user.id,
          vote_type: vote_type || "up",
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating vote:", error);
        return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
      }

      return NextResponse.json({ vote, action: "created" });
    }
  } catch (error) {
    console.error("Error in vote POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
