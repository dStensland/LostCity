import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

// Type helper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

// GET /api/lists - List all public lists, optionally filtered
export async function GET(request: NextRequest) {
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;
  const supabase = await createClient() as AnySupabase;
  const searchParams = request.nextUrl.searchParams;

  const portalId = searchParams.get("portal_id");
  const portalSlug = searchParams.get("portal_slug");
  const slug = searchParams.get("slug");
  const category = searchParams.get("category");
  const creatorId = searchParams.get("creator_id");
  const sortBy = searchParams.get("sort"); // "trending" | "newest" | "votes"
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    // If slug is provided, fetch single list by slug
    if (slug) {
      let query = supabase
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
            venue:venues(id, name, slug, neighborhood, venue_type, image_url),
            event:events(id, title, start_date, image_url, venue:venues(name))
          )
        `)
        .eq("slug", slug)
        .eq("status", "active");

      // Filter by portal if provided
      if (portalSlug) {
        const { data: portal } = await supabase
          .from("portals")
          .select("id")
          .eq("slug", portalSlug)
          .maybeSingle();

        if (portal) {
          query = query.eq("portal_id", portal.id);
        }
      }

      const { data: list, error } = await query.maybeSingle();

      if (error) {
        console.error("Error fetching list by slug:", error);
        return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
      }

      if (!list) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }

      // Fetch creator profile separately
      const { data: creator } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", list.creator_id)
        .maybeSingle();

      // Get vote counts for each item (only if there are items)
      const itemIds = list.items?.map((item: { id: string }) => item.id) || [];
      let itemVotes: { item_id: string; vote_type: string }[] = [];
      let userVotes: { item_id: string; vote_type: string }[] = [];

      if (itemIds.length > 0) {
        const { data: votes } = await supabase
          .from("list_item_votes")
          .select("item_id, vote_type")
          .in("item_id", itemIds);
        itemVotes = votes || [];

        // Get current user's votes
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: uVotes } = await supabase
            .from("list_item_votes")
            .select("item_id, vote_type")
            .eq("user_id", user.id)
            .in("item_id", itemIds);
          userVotes = uVotes || [];
        }
      }

      // Calculate vote counts per item
      const voteCountMap: Record<string, number> = {};
      const userVoteMap: Record<string, "up" | "down"> = {};

      itemVotes.forEach((vote) => {
        const delta = vote.vote_type === "up" ? 1 : -1;
        voteCountMap[vote.item_id] = (voteCountMap[vote.item_id] || 0) + delta;
      });

      userVotes.forEach((vote) => {
        userVoteMap[vote.item_id] = vote.vote_type as "up" | "down";
      });

      // Transform items with vote data
      interface ListItemRaw {
        id: string;
        item_type: string;
        venue_id: number | null;
        event_id: number | null;
        organization_id: number | null;
        custom_name: string | null;
        custom_description: string | null;
        position: number;
        venue?: unknown;
        event?: unknown;
        organization?: unknown;
      }

      const transformedItems = list.items?.map((item: ListItemRaw) => ({
        ...item,
        list_id: list.id,
        vote_count: voteCountMap[item.id] || 0,
        user_vote: userVoteMap[item.id] || null,
      })) || [];

      // Get total vote count for the list
      const { count: voteCount } = await supabase
        .from("list_votes")
        .select("*", { count: "exact", head: true })
        .eq("list_id", list.id);

      return NextResponse.json({
        list: {
          ...list,
          creator: creator || null,
          items: transformedItems,
          item_count: list.items?.length || 0,
          vote_count: voteCount || 0,
        },
      });
    }

    // Otherwise, list all public lists
    let query = supabase
      .from("lists")
      .select(`
        *,
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
      const { data: portal } = await supabase
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

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching lists:", error);
      return NextResponse.json({ error: "Failed to fetch lists", details: error.message }, { status: 500 });
    }

    // Fetch creator profiles for all lists
    const creatorIds = [...new Set((data || []).map((l: { creator_id: string }) => l.creator_id))];
    const listIds = (data || []).map((l: { id: string }) => l.id);

    const { data: creators } = creatorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", creatorIds)
      : { data: [] };

    // Fetch vote counts for all lists
    const { data: voteCounts } = listIds.length > 0
      ? await supabase
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
        vote_count: voteCountMap[list.id] || 0,
        thumbnails,
        list_items: undefined,
      };
    });

    // Sort based on sortBy parameter
    if (sortBy === "votes" || sortBy === "trending") {
      lists = lists.sort((a, b) => (b.vote_count as number) - (a.vote_count as number));
    } else if (sortBy === "newest") {
      lists = lists.sort((a, b) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      );
    }
    // Default is already newest from the query order

    return NextResponse.json({ lists });
  } catch (error) {
    console.error("Error in lists GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/lists - Create a new list
export async function POST(request: NextRequest) {
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient() as AnySupabase;

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { portal_id, title, description, category, is_public } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
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
      .insert({
        portal_id: portal_id || null,
        creator_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        category: category || null,
        is_public: is_public !== false,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Error creating list:", error);
      return NextResponse.json({ error: "Failed to create list", details: error.message }, { status: 500 });
    }

    // Fetch creator profile separately (creator_id FK is to auth.users, not profiles)
    const { data: creator } = await supabase
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
    console.error("Error in lists POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
