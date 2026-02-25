import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam, type AnySupabase } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

/**
 * GET /api/curations/discover
 * Discovery endpoint for browsing curations
 * Returns sections: featured, trending, popular, newest
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portalSlug = searchParams.get("portal_slug");
  const vibeTagsParam = searchParams.get("vibe_tags"); // comma-separated
  const sort = searchParams.get("sort") || "trending"; // trending | newest | popular
  const limit = parseIntParam(searchParams.get("limit"), 20);

  try {
    let svc: AnySupabase;
    try {
      svc = createServiceClient() as AnySupabase;
    } catch {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
    }

    // Resolve portal_id from slug
    let portalId: string | null = null;
    if (portalSlug) {
      const { data: portal } = await svc
        .from("portals")
        .select("id")
        .eq("slug", portalSlug)
        .maybeSingle();
      portalId = portal?.id || null;
    }

    const vibeTags = vibeTagsParam ? vibeTagsParam.split(",").map(t => t.trim()).filter(Boolean) : [];

    // Base query builder
    const buildQuery = (sortField: string, ascending: boolean, queryLimit: number) => {
      let query = svc
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
        .order(sortField, { ascending })
        .limit(queryLimit);

      if (portalId) {
        query = query.eq("portal_id", portalId);
      }

      if (vibeTags.length > 0) {
        query = query.overlaps("vibe_tags", vibeTags);
      }

      return query;
    };

    // Transform raw list rows: extract thumbnails, strip list_items, attach creator
    interface ItemPreview {
      position: number;
      venue?: { image_url: string | null } | null;
      event?: { image_url: string | null } | null;
    }
    type CreatorProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null };

    const transformLists = (
      lists: { creator_id: string; list_items?: ItemPreview[]; [key: string]: unknown }[],
      creatorMap: Map<string, CreatorProfile>,
    ) => lists.map((list) => {
      const items = (list.list_items as ItemPreview[] | undefined) || [];
      const thumbnails: string[] = [];
      const sorted = [...items].sort((a, b) => a.position - b.position);
      for (const item of sorted) {
        if (thumbnails.length >= 3) break;
        const img = item.venue?.image_url || item.event?.image_url;
        if (img && !thumbnails.includes(img)) thumbnails.push(img);
      }

      const creator = creatorMap.get(list.creator_id);
      return {
        ...list,
        creator: creator ? {
          username: creator.username,
          display_name: creator.display_name,
          avatar_url: creator.avatar_url,
        } : null,
        item_count: items.length,
        thumbnails,
        list_items: undefined,
      };
    });

    // Fetch all creators for a set of lists in one query
    const fetchCreatorMap = async (allLists: { creator_id: string }[][]) => {
      const creatorIds = [...new Set(allLists.flat().map(l => l.creator_id))];
      if (creatorIds.length === 0) return new Map<string, CreatorProfile>();
      const { data: creators } = await svc
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", creatorIds);
      return new Map(
        (creators || []).map((c: CreatorProfile) => [c.id, c])
      );
    };

    // If a specific sort is requested, return a single sorted list
    if (sort === "newest") {
      const { data, error } = await buildQuery("created_at", false, limit ?? 20);
      if (error) return NextResponse.json({ error: "Failed to fetch curations" }, { status: 500 });
      const creatorMap = await fetchCreatorMap([data || []]);
      return NextResponse.json({ curations: transformLists(data || [], creatorMap), sort });
    }

    if (sort === "popular") {
      const { data, error } = await buildQuery("follower_count", false, limit ?? 20);
      if (error) return NextResponse.json({ error: "Failed to fetch curations" }, { status: 500 });
      const creatorMap = await fetchCreatorMap([data || []]);
      return NextResponse.json({ curations: transformLists(data || [], creatorMap), sort });
    }

    // Default: trending (by upvote_count)
    // Also return sections for discovery page
    const [featuredRes, trendingRes, newestRes] = await Promise.all([
      // Featured: editorial curations
      buildQuery("upvote_count", false, 6).eq("owner_type", "editorial"),
      // Trending: highest upvote_count
      buildQuery("upvote_count", false, limit ?? 20),
      // Newest
      buildQuery("created_at", false, 6),
    ]);

    // Single profiles query for all sections (instead of 3 separate calls)
    const creatorMap = await fetchCreatorMap([
      featuredRes.data || [],
      trendingRes.data || [],
      newestRes.data || [],
    ]);

    const featured = transformLists(featuredRes.data || [], creatorMap);
    const trending = transformLists(trendingRes.data || [], creatorMap);
    const newest = transformLists(newestRes.data || [], creatorMap);

    return NextResponse.json({
      sections: {
        featured,
        trending,
        newest,
      },
      curations: trending,
      sort: "trending",
    });
  } catch (error) {
    logger.error("Error in curations discover", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
