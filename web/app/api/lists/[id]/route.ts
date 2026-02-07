import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import type { AnySupabase } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/lists/[id] - Get a single list with items
export async function GET(request: NextRequest, context: RouteContext) {
  // Apply rate limiting (read tier - public read endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient() as AnySupabase;
  const { id } = await context.params;

  // Use service client for data queries — bypasses RLS so we can see
  // any public list regardless of the requesting user's auth state.
  let svc: AnySupabase;
  try {
    svc = createServiceClient() as AnySupabase;
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
  }

  try {
    // Get the list
    const { data: list, error: listError } = await svc
      .from("lists")
      .select(`
        *,
        creator:profiles!creator_id(username, display_name, avatar_url)
      `)
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Only allow viewing public lists (or own lists via auth)
    if (!list.is_public) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== list.creator_id) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
    }

    // Get current user for vote status
    const { data: { user } } = await supabase.auth.getUser();

    // Get items with vote counts
    const { data: items, error: itemsError } = await svc
      .from("list_items")
      .select(`
        *,
        venue:venues(id, name, slug, neighborhood, venue_type),
        event:events(id, title, start_date, venue:venues(name)),
        organization:organizations(id, name, slug)
      `)
      .eq("list_id", id)
      .order("position", { ascending: true });

    if (itemsError) {
      logger.error("Error fetching list items", itemsError);
    }

    // Get vote counts for items
    const { data: voteCounts } = await svc
      .from("list_votes")
      .select("item_id")
      .eq("list_id", id)
      .not("item_id", "is", null);

    // Get user votes if logged in
    let userVotes: Record<string, string> = {};
    if (user) {
      const { data: votes } = await svc
        .from("list_votes")
        .select("item_id, vote_type")
        .eq("list_id", id)
        .eq("user_id", user.id);

      if (votes) {
        userVotes = votes.reduce((acc: Record<string, string>, v: { item_id: string | null; vote_type: string }) => {
          if (v.item_id) acc[v.item_id] = v.vote_type;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Count votes per item
    const itemVoteCounts: Record<string, number> = {};
    if (voteCounts) {
      voteCounts.forEach((v: { item_id: string | null }) => {
        if (v.item_id) {
          itemVoteCounts[v.item_id] = (itemVoteCounts[v.item_id] || 0) + 1;
        }
      });
    }

    // Attach vote info to items
    interface ListItemRow {
      id: string;
      [key: string]: unknown;
    }
    const itemsWithVotes = (items || []).map((item: ListItemRow) => ({
      ...item,
      vote_count: itemVoteCounts[item.id] || 0,
      user_vote: userVotes[item.id] || null,
    }));

    // Get total vote count for the list
    const { count: totalVotes } = await svc
      .from("list_votes")
      .select("*", { count: "exact", head: true })
      .eq("list_id", id);

    return NextResponse.json({
      list: {
        ...list,
        item_count: items?.length || 0,
        vote_count: totalVotes || 0,
      },
      items: itemsWithVotes,
    });
  } catch (error) {
    logger.error("Error in list GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/lists/[id] - Update a list
export async function PATCH(request: NextRequest, context: RouteContext) {
  // Apply rate limiting (write tier - updates data)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient() as AnySupabase;
  const { id } = await context.params;

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check ownership
    const { data: existingList } = await supabase
      .from("lists")
      .select("creator_id")
      .eq("id", id)
      .maybeSingle();

    if (!existingList) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    if (existingList.creator_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to update this list" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.category !== undefined) updates.category = body.category;
    if (body.is_public !== undefined) updates.is_public = body.is_public;
    if (body.status !== undefined) {
      // Validate status against allowlist
      const VALID_STATUSES = ["active", "archived", "deleted"];
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      updates.status = body.status;
    }

    // Use service client to bypass RLS - auth already validated above
    let serviceClient: AnySupabase;
    try {
      serviceClient = createServiceClient() as AnySupabase;
    } catch {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
    }

    const { data: list, error } = await serviceClient
      .from("lists")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      logger.error("Error updating list", error);
      return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
    }

    return NextResponse.json({ list });
  } catch (error) {
    logger.error("Error in list PATCH", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/lists/[id] - Delete a list (soft delete)
export async function DELETE(request: NextRequest, context: RouteContext) {
  // Apply rate limiting (write tier - deletes data)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient() as AnySupabase;
  const { id } = await context.params;

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check ownership
    const { data: existingList } = await supabase
      .from("lists")
      .select("creator_id")
      .eq("id", id)
      .maybeSingle();

    if (!existingList) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    if (existingList.creator_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this list" }, { status: 403 });
    }

    // Use service client to bypass RLS - auth already validated above
    let serviceClient: AnySupabase;
    try {
      serviceClient = createServiceClient() as AnySupabase;
    } catch {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
    }

    // Soft delete
    const { error } = await serviceClient
      .from("lists")
      .update({ status: "deleted" })
      .eq("id", id);

    if (error) {
      logger.error("Error deleting list", error);
      return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error in list DELETE", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
