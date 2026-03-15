import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, isValidUrl, type AnySupabase } from "@/lib/api-utils";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { isValidSubmissionMode, isValidOwnerType, isValidVibeTags, isValidHexColor } from "@/lib/curation-utils";

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
    // Step 1: Fetch the list (must come first to verify existence)
    const { data: list, error: listError } = await svc
      .from("lists")
      .select("*")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Step 2: Parallelize independent queries — auth, creator, items, vote counts
    const [
      { data: { user } },
      { data: creator },
      { data: items, error: itemsError },
      { data: voteCounts },
    ] = await Promise.all([
      supabase.auth.getUser(),
      svc.from("profiles").select("username, display_name, avatar_url").eq("id", list.creator_id).maybeSingle(),
      svc.from("list_items").select(`
        *,
        venue:venues(id, name, slug, neighborhood, venue_type),
        event:events(id, title, start_date, venue:venues(name)),
        organization:organizations(id, name, slug)
      `).eq("list_id", id).order("position", { ascending: true }),
      svc.from("list_votes").select("item_id").eq("list_id", id).not("item_id", "is", null),
    ]);

    if (itemsError) {
      logger.error("Error fetching list items", itemsError);
    }

    list.creator = creator;

    // Private list access check
    if (!list.is_public) {
      if (!user || user.id !== list.creator_id) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
    }

    // Step 3: User-dependent queries (parallel)
    let userVotes: Record<string, string> = {};
    let isFollowing = false;

    if (user) {
      const [votesResult, followResult] = await Promise.all([
        svc.from("list_votes").select("item_id, vote_type").eq("list_id", id).eq("user_id", user.id),
        svc.from("curation_follows").select("id").eq("list_id", id).eq("user_id", user.id).maybeSingle(),
      ]);

      if (votesResult.data) {
        userVotes = votesResult.data.reduce((acc: Record<string, string>, v: { item_id: string | null; vote_type: string }) => {
          if (v.item_id) acc[v.item_id] = v.vote_type;
          return acc;
        }, {} as Record<string, string>);
      }
      isFollowing = !!followResult.data;
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

    return NextResponse.json({
      list: {
        ...list,
        item_count: items?.length || 0,
        vote_count: list.upvote_count ?? 0,
        is_following: isFollowing,
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
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

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
    if (body.allow_contributions !== undefined) updates.allow_contributions = body.allow_contributions;
    if (body.status !== undefined) {
      const VALID_STATUSES = ["active", "archived", "deleted"];
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      updates.status = body.status;
    }

    // Curation-specific fields
    if (body.cover_image_url !== undefined) {
      if (body.cover_image_url && !isValidUrl(body.cover_image_url)) {
        return NextResponse.json({ error: "Invalid cover image URL" }, { status: 400 });
      }
      updates.cover_image_url = body.cover_image_url || null;
    }
    if (body.accent_color !== undefined) {
      if (body.accent_color && !isValidHexColor(body.accent_color)) {
        return NextResponse.json({ error: "Invalid accent color (use #RRGGBB)" }, { status: 400 });
      }
      updates.accent_color = body.accent_color || null;
    }
    if (body.vibe_tags !== undefined) {
      if (!isValidVibeTags(body.vibe_tags)) {
        return NextResponse.json({ error: "Invalid vibe tags" }, { status: 400 });
      }
      updates.vibe_tags = body.vibe_tags;
    }
    if (body.submission_mode !== undefined) {
      if (!isValidSubmissionMode(body.submission_mode)) {
        return NextResponse.json({ error: "Invalid submission mode" }, { status: 400 });
      }
      updates.submission_mode = body.submission_mode;
      if (body.submission_mode === "open") updates.allow_contributions = true;
    }
    if (body.owner_type !== undefined) {
      if (!isValidOwnerType(body.owner_type)) {
        return NextResponse.json({ error: "Invalid owner type" }, { status: 400 });
      }
      updates.owner_type = body.owner_type;
    }
    if (body.is_pinned !== undefined) updates.is_pinned = !!body.is_pinned;

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
