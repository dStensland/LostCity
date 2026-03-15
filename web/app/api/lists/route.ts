import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse, isValidUrl, parseIntParam, type AnySupabase } from "@/lib/api-utils";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { isValidSubmissionMode, isValidOwnerType, isValidVibeTags, isValidHexColor } from "@/lib/curation-utils";

// GET /api/lists - List all public lists, optionally filtered
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;
  const supabase = await createClient() as AnySupabase;
  const searchParams = request.nextUrl.searchParams;

  const portalId = searchParams.get("portal_id");
  const portalSlug = searchParams.get("portal_slug");
  const slug = searchParams.get("slug");
  const category = searchParams.get("category");
  const creatorId = searchParams.get("creator_id");
  const vibeTag = searchParams.get("vibe_tag");
  const ownerType = searchParams.get("owner_type");
  const sortBy = searchParams.get("sort"); // "trending" | "newest" | "votes" | "popular"
  const limit = parseIntParam(searchParams.get("limit")) ?? 50;
  const offset = parseIntParam(searchParams.get("offset")) ?? 0;

  try {
    // If slug is provided, fetch single list by slug
    if (slug) {
      // Use service client to fetch list data — ensures we can see any
      // public list regardless of who is requesting it.
      let svc: AnySupabase;
      try {
        svc = createServiceClient() as AnySupabase;
      } catch {
        return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
      }

      // --- Round 1: Fetch list + auth in parallel ---
      let listQuery = svc
        .from("lists")
        .select(`
          *,
          portal:portals(slug),
          items:list_items(
            id,
            item_type,
            venue_id,
            event_id,
            organization_id,
            custom_name,
            custom_description,
            position,
            added_by,
            blurb,
            upvote_count,
            status,
            submitted_by,
            venue:venues(id, name, slug, neighborhood, venue_type, image_url),
            event:events(id, title, start_date, image_url, venue:venues(name))
          )
        `)
        .eq("slug", slug)
        .eq("status", "active");

      // Resolve portal filter inline if needed
      if (portalSlug) {
        const { data: portal } = await svc
          .from("portals")
          .select("id")
          .eq("slug", portalSlug)
          .maybeSingle();
        if (portal) {
          listQuery = listQuery.eq("portal_id", portal.id);
        }
      }

      const [listResult, authResult] = await Promise.all([
        listQuery.maybeSingle(),
        supabase.auth.getUser(),
      ]);

      if (listResult.error) {
        logger.error("Error fetching list by slug", listResult.error);
        return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
      }

      const list = listResult.data;
      if (!list) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }

      const user = authResult.data?.user ?? null;

      // Private list access check
      if (!list.is_public) {
        if (!user || user.id !== list.creator_id) {
          return NextResponse.json({ error: "List not found" }, { status: 404 });
        }
      }

      // --- Round 2: Parallelize creator, votes, follow, contributors ---
      interface ListItemRaw {
        id: string;
        item_type: string;
        venue_id: number | null;
        event_id: number | null;
        organization_id: number | null;
        custom_name: string | null;
        custom_description: string | null;
        position: number;
        added_by: string | null;
        venue?: unknown;
        event?: unknown;
        organization?: unknown;
      }

      const itemIds = list.items?.map((item: { id: string }) => item.id) || [];
      const contributorIds = [
        ...new Set(
          (list.items || [])
            .map((item: ListItemRaw) => item.added_by)
            .filter((id: string | null): id is string => !!id && id !== list.creator_id)
        ),
      ];

      // Execute all independent queries in parallel
      const [creatorRes, itemVotesRes, userVotesRes, followRes, contributorsRes] = await Promise.all([
        svc.from("profiles").select("username, display_name, avatar_url").eq("id", list.creator_id).maybeSingle(),
        itemIds.length > 0
          ? svc.from("list_votes").select("item_id, vote_type").in("item_id", itemIds)
          : { data: [] as { item_id: string; vote_type: string }[] },
        user && itemIds.length > 0
          ? svc.from("list_votes").select("item_id, vote_type").eq("user_id", user.id).in("item_id", itemIds)
          : { data: [] as { item_id: string; vote_type: string }[] },
        user
          ? svc.from("curation_follows").select("id").eq("list_id", list.id).eq("user_id", user.id).maybeSingle()
          : { data: null as { id: string } | null },
        contributorIds.length > 0
          ? svc.from("profiles").select("id, username, display_name").in("id", contributorIds)
          : { data: [] as { id: string; username: string; display_name: string | null }[] },
      ]);

      // Calculate vote counts per item
      const voteCountMap: Record<string, number> = {};
      const userVoteMap: Record<string, "up" | "down"> = {};

      (itemVotesRes.data || []).forEach((vote) => {
        const delta = vote.vote_type === "up" ? 1 : -1;
        voteCountMap[vote.item_id] = (voteCountMap[vote.item_id] || 0) + delta;
      });

      (userVotesRes.data || []).forEach((vote) => {
        userVoteMap[vote.item_id] = vote.vote_type as "up" | "down";
      });

      const contributorMap = new Map(
        (contributorsRes.data || []).map((c) => [c.id, c])
      );

      const transformedItems = list.items?.map((item: ListItemRaw) => ({
        ...item,
        list_id: list.id,
        vote_count: voteCountMap[item.id] || 0,
        user_vote: userVoteMap[item.id] || null,
        added_by_profile: item.added_by && item.added_by !== list.creator_id
          ? contributorMap.get(item.added_by) || null
          : null,
      })) || [];

      return NextResponse.json({
        list: {
          ...list,
          creator: creatorRes.data || null,
          items: transformedItems,
          item_count: list.items?.length || 0,
          vote_count: list.upvote_count ?? 0,
          is_following: !!followRes.data,
        },
      });
    }

    // Otherwise, list all public lists
    // Use service client to bypass RLS — the query explicitly filters for
    // is_public=true so this is safe, and avoids issues where the user-scoped
    // client can't see other users' public lists.
    let svc: AnySupabase;
    try {
      svc = createServiceClient() as AnySupabase;
    } catch {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
    }

    let query = svc
      .from("lists")
      .select(`
        *,
        portal:portals(slug),
        list_items(
          position,
          venue:venues(image_url),
          event:events(image_url)
        )
      `)
      .eq("status", "active")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (portalId) {
      query = query.eq("portal_id", portalId);
    }

    if (portalSlug && !portalId) {
      const { data: portal } = await svc
        .from("portals")
        .select("id")
        .eq("slug", portalSlug)
        .maybeSingle();

      if (portal) {
        query = query.eq("portal_id", portal.id);
      }
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (creatorId) {
      query = query.eq("creator_id", creatorId);
    }

    if (vibeTag) {
      query = query.contains("vibe_tags", [vibeTag]);
    }

    if (ownerType) {
      query = query.eq("owner_type", ownerType);
    }

    const { data, error } = await query;

    if (error) {
      return errorResponse(error, "GET /api/lists");
    }

    // Fetch creator profiles for all lists
    const creatorIds = [...new Set((data || []).map((l: { creator_id: string }) => l.creator_id))];
    const listIds = (data || []).map((l: { id: string }) => l.id);

    const { data: creators } = creatorIds.length > 0
      ? await svc
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", creatorIds)
      : { data: [] };

    // Fetch vote counts for all lists
    const { data: voteCounts } = listIds.length > 0
      ? await svc
          .from("list_votes")
          .select("list_id")
          .in("list_id", listIds)
      : { data: [] };

    // Count votes per list
    const voteCountMap: Record<string, number> = {};
    (voteCounts || []).forEach((v: { list_id: string }) => {
      voteCountMap[v.list_id] = (voteCountMap[v.list_id] || 0) + 1;
    });

    const creatorMap = new Map(
      (creators || []).map((c: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => [c.id, c])
    );

    // Transform the data to include counts and thumbnails
    interface ItemPreview {
      position: number;
      venue?: { image_url: string | null } | null;
      event?: { image_url: string | null } | null;
    }
    interface ListData {
      id: string;
      creator_id: string;
      list_items?: ItemPreview[];
      created_at?: string;
      [key: string]: unknown;
    }
    let lists = (data || []).map((list: ListData) => {
      // Extract thumbnail URLs from first 3 items with images
      const thumbnails: string[] = [];
      const sortedPreviews = (list.list_items || [])
        .sort((a, b) => a.position - b.position);

      for (const item of sortedPreviews) {
        if (thumbnails.length >= 3) break;
        const imageUrl = item.venue?.image_url || item.event?.image_url;
        if (imageUrl && !thumbnails.includes(imageUrl)) {
          thumbnails.push(imageUrl);
        }
      }

      const creator = creatorMap.get(list.creator_id);
      return {
        ...list,
        creator: creator ? {
          username: creator.username,
          display_name: creator.display_name,
          avatar_url: creator.avatar_url,
        } : null,
        item_count: sortedPreviews.length,
        // Use cached upvote_count from DB, fallback to computed vote count
        vote_count: (list as { upvote_count?: number }).upvote_count ?? voteCountMap[list.id] ?? 0,
        thumbnails,
        list_items: undefined,
      };
    });

    // Sort based on sortBy parameter
    if (sortBy === "votes" || sortBy === "trending") {
      lists = lists.sort((a, b) => (b.vote_count as number) - (a.vote_count as number));
    } else if (sortBy === "popular") {
      lists = lists.sort((a, b) =>
        ((b as { follower_count?: number }).follower_count ?? 0) -
        ((a as { follower_count?: number }).follower_count ?? 0)
      );
    } else if (sortBy === "newest") {
      lists = lists.sort((a, b) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      );
    }
    // Default is already newest from the query order

    return NextResponse.json({ lists });
  } catch (error) {
    logger.error("Error in lists GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/lists - Create a new list
export const POST = withAuth(async (request: NextRequest, { user, serviceClient, supabase }) => {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const svc = serviceClient as AnySupabase;
  const sub = supabase as AnySupabase;

  try {
    const body = await request.json();
    const {
      portal_id, title, description, category, is_public, allow_contributions,
      cover_image_url, accent_color, vibe_tags, submission_mode, owner_type,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Validate optional curation fields
    if (cover_image_url && !isValidUrl(cover_image_url)) {
      return NextResponse.json({ error: "Invalid cover image URL" }, { status: 400 });
    }
    if (accent_color && !isValidHexColor(accent_color)) {
      return NextResponse.json({ error: "Invalid accent color (use #RRGGBB)" }, { status: 400 });
    }
    if (vibe_tags !== undefined && !isValidVibeTags(vibe_tags)) {
      return NextResponse.json({ error: "Invalid vibe tags (lowercase, hyphens only, max 10)" }, { status: 400 });
    }
    if (submission_mode !== undefined && !isValidSubmissionMode(submission_mode)) {
      return NextResponse.json({ error: "Invalid submission mode" }, { status: 400 });
    }
    if (owner_type !== undefined && !isValidOwnerType(owner_type)) {
      return NextResponse.json({ error: "Invalid owner type" }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      portal_id: portal_id || null,
      creator_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      category: category || null,
      is_public: is_public !== false,
      allow_contributions: allow_contributions === true,
    };

    // Add curation-specific fields if provided
    if (cover_image_url) insertData.cover_image_url = cover_image_url;
    if (accent_color) insertData.accent_color = accent_color;
    if (vibe_tags) insertData.vibe_tags = vibe_tags;
    if (submission_mode) {
      insertData.submission_mode = submission_mode;
      // Keep allow_contributions in sync
      if (submission_mode === "open") insertData.allow_contributions = true;
    }
    if (owner_type) insertData.owner_type = owner_type;

    const { data: list, error } = await svc
      .from("lists")
      .insert(insertData)
      .select("*")
      .maybeSingle();

    if (error) {
      return errorResponse(error, "POST /api/lists");
    }

    // Fetch creator profile separately (creator_id FK is to auth.users, not profiles)
    const { data: creator } = await sub
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      list: {
        ...list,
        creator: creator || null,
        item_count: 0,
        vote_count: 0,
      },
    });
  } catch (error) {
    logger.error("Error in lists POST", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
