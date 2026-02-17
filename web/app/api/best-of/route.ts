import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

type NominationRow = {
  category_id: string;
  venue_id: number;
};

type VenuePreviewRow = {
  id: number;
  name: string;
  image_url: string | null;
  hero_image_url: string | null;
  neighborhood: string | null;
};

type ScoreRow = {
  venue_id: number;
  algorithm_score: number;
};

type VoteCountRow = {
  category_id: string;
  vote_count: number;
};

/**
 * GET /api/best-of
 * List all active categories for a portal, with top-3 venue previews per category
 * Query: ?portal=atlanta
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const ctx = await resolvePortalQueryContext(supabase, searchParams);

    if (!ctx.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const { data: categories, error } = await supabase
      .from("best_of_categories")
      .select("id, slug, name, description, icon, sort_order")
      .eq("portal_id", ctx.portalId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Best-of categories fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }

    const rows = (categories ?? []) as unknown as CategoryRow[];
    const categoryIds = rows.map((c) => c.id);

    if (categoryIds.length === 0) {
      return NextResponse.json(
        { categories: [] },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    // Parallel: vote counts (RPC) + nominations
    const [{ data: voteCountData }, { data: nomData }] = await Promise.all([
      supabase.rpc("best_of_vote_counts_by_category" as never, { p_category_ids: categoryIds } as never),
      supabase
        .from("best_of_nominations")
        .select("category_id, venue_id")
        .in("category_id", categoryIds)
        .eq("status", "approved"),
    ]);

    const voteCounts = new Map<string, number>();
    for (const v of (voteCountData ?? []) as unknown as VoteCountRow[]) {
      voteCounts.set(v.category_id, Number(v.vote_count));
    }

    const nominationsByCategory = new Map<string, number[]>();
    for (const n of (nomData ?? []) as unknown as NominationRow[]) {
      const list = nominationsByCategory.get(n.category_id) ?? [];
      list.push(n.venue_id);
      nominationsByCategory.set(n.category_id, list);
    }

    // Collect all nominated venue IDs for batch venue fetch
    const allVenueIds = new Set<number>();
    for (const [, ids] of nominationsByCategory) {
      for (const id of ids) allVenueIds.add(id);
    }

    // Fetch venue metadata + scores for top-3 previews
    const venueMap = new Map<number, VenuePreviewRow>();
    const scoreMap = new Map<number, number>();

    if (allVenueIds.size > 0) {
      const venueIdArr = Array.from(allVenueIds);

      const [{ data: venueData }, { data: scoreData }] = await Promise.all([
        supabase
          .from("venues")
          .select("id, name, image_url, hero_image_url, neighborhood")
          .in("id", venueIdArr),
        supabase
          .from("best_of_venue_scores")
          .select("venue_id, algorithm_score")
          .in("venue_id", venueIdArr),
      ]);

      for (const v of (venueData ?? []) as unknown as VenuePreviewRow[]) {
        venueMap.set(v.id, v);
      }
      for (const s of (scoreData ?? []) as unknown as ScoreRow[]) {
        scoreMap.set(s.venue_id, s.algorithm_score);
      }
    }

    // Build top-3 previews per category (sorted by score DESC)
    const result = rows.map((c) => {
      const nominatedIds = nominationsByCategory.get(c.id) ?? [];
      const scored = nominatedIds
        .map((vid) => ({ vid, score: scoreMap.get(vid) ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const topVenues = scored
        .map(({ vid, score }) => {
          const v = venueMap.get(vid);
          if (!v) return null;
          return {
            venueId: v.id,
            name: v.name,
            imageUrl: v.hero_image_url ?? v.image_url,
            neighborhood: v.neighborhood,
            score,
          };
        })
        .filter(Boolean);

      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        icon: c.icon,
        sortOrder: c.sort_order,
        voteCount: voteCounts.get(c.id) ?? 0,
        nominationCount: nominatedIds.length,
        topVenues,
      };
    });

    return NextResponse.json(
      { categories: result },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Best-of API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
