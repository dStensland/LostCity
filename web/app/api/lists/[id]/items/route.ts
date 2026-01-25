import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Type helper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/lists/[id]/items - Get items for a list
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await createClient() as AnySupabase;
  const { id: listId } = await context.params;

  try {
    const { data: items, error } = await supabase
      .from("list_items")
      .select(`
        *,
        venue:venues(id, name, slug, neighborhood, spot_type),
        event:events(id, title, start_date, venue:venues(name)),
        producer:producers(id, name, slug)
      `)
      .eq("list_id", listId)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching list items:", error);
      return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
    }

    return NextResponse.json({ items: items || [] });
  } catch (error) {
    console.error("Error in list items GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/lists/[id]/items - Add an item to a list
export async function POST(request: NextRequest, context: RouteContext) {
  const supabase = await createClient() as AnySupabase;
  const { id: listId } = await context.params;

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check list ownership
    const { data: list } = await supabase
      .from("lists")
      .select("creator_id")
      .eq("id", listId)
      .single();

    if (!list || list.creator_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to add items to this list" }, { status: 403 });
    }

    const body = await request.json();
    const { item_type, venue_id, event_id, producer_id, custom_name, custom_description } = body;

    if (!item_type) {
      return NextResponse.json({ error: "Item type is required" }, { status: 400 });
    }

    // Validate that we have a reference
    if (!venue_id && !event_id && !producer_id && !custom_name) {
      return NextResponse.json({ error: "Item must have a venue, event, producer, or custom name" }, { status: 400 });
    }

    // Get the next position
    const { data: lastItem } = await supabase
      .from("list_items")
      .select("position")
      .eq("list_id", listId)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (lastItem?.position || 0) + 1;

    const { data: item, error } = await supabase
      .from("list_items")
      .insert({
        list_id: listId,
        item_type,
        venue_id: venue_id || null,
        event_id: event_id || null,
        producer_id: producer_id || null,
        custom_name: custom_name || null,
        custom_description: custom_description || null,
        position: nextPosition,
        added_by: user.id,
      })
      .select(`
        *,
        venue:venues(id, name, slug, neighborhood, spot_type),
        event:events(id, title, start_date, venue:venues(name)),
        producer:producers(id, name, slug)
      `)
      .single();

    if (error) {
      console.error("Error adding list item:", error);
      return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
    }

    return NextResponse.json({
      item: {
        ...item,
        vote_count: 0,
        user_vote: null,
      },
    });
  } catch (error) {
    console.error("Error in list items POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
