import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  portal_id: string;
};

type VenueScoreRow = {
  venue_id: number;
  algorithm_score: number;
};

type VenueRow = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  image_url: string | null;
  hero_image_url: string | null;
  venue_type: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type TopCaseRow = {
  id: string;
  user_id: string;
  venue_id: number;
  content: string;
  upvote_count: number;
  created_at: string;
};

type VoteCountRow = { venue_id: number; vote_count: number };
type CaseCountRow = { venue_id: number; case_count: number; upvote_sum: number };

/**
 * GET /api/best-of/[slug]
 * Full leaderboard for a category
 * Query: ?portal=atlanta
 */
export const GET = withOptionalAuth(async (request: NextRequest, { user, supabase }) => {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    // Extract slug from URL path using Next.js-compatible parsing
    const pathname = new URL(request.url).pathname;
    const slug = pathname.split("/api/best-of/")[1]?.split("/")[0];

    if (!slug) {
      return NextResponse.json({ error: "Missing category slug" }, { status: 400 });
    }

    const ctx = await resolvePortalQueryContext(supabase, searchParams);
    if (!ctx.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // 1. Look up category (with portal scoping)
    const { data: catData, error: catError } = await supabase
      .from("best_of_categories")
      .select("*")
      .eq("slug", slug)
      .eq("portal_id", ctx.portalId)
      .eq("is_active", true)
      .maybeSingle();

    if (catError || !catData) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const category = catData as unknown as CategoryRow;

    // 2. Get approved nominations for this category (only these venues appear)
    const { data: nomData } = await supabase
      .from("best_of_nominations")
      .select("venue_id")
      .eq("category_id", category.id)
      .eq("status", "approved");

    const nominatedVenueIds = new Set<number>();
    for (const row of (nomData ?? []) as unknown as { venue_id: number }[]) {
      nominatedVenueIds.add(row.venue_id);
    }

    if (nominatedVenueIds.size === 0) {
      return NextResponse.json({
        category: {
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: category.description,
          icon: category.icon,
          isActive: true,
          sortOrder: category.sort_order,
        },
        venues: [],
        userVoteVenueId: null,
        totalVotes: 0,
      }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      });
    }

    const venueIdArr = Array.from(nominatedVenueIds);

    // 3. Parallel batch: scores, vote counts (RPC), top cases (RPC), case counts (RPC), venue metadata
    const [
      { data: scoreData },
      { data: voteCountData },
      { data: totalVoteData },
      { data: topCaseData },
      { data: caseCountData },
      { data: venueData },
    ] = await Promise.all([
      supabase
        .from("best_of_venue_scores")
        .select("venue_id, algorithm_score")
        .in("venue_id", venueIdArr),
      supabase.rpc("best_of_vote_counts_by_venue", { p_category_id: category.id }),
      supabase.rpc("best_of_total_votes", { p_category_id: category.id }),
      supabase.rpc("best_of_top_cases", { p_category_id: category.id }),
      supabase.rpc("best_of_case_counts", { p_category_id: category.id }),
      supabase
        .from("venues")
        .select("id, name, slug, neighborhood, image_url, hero_image_url, venue_type")
        .in("id", venueIdArr)
        .eq("active", true),
    ]);

    // Build lookup maps
    const scores = new Map<number, number>();
    for (const row of (scoreData ?? []) as unknown as VenueScoreRow[]) {
      scores.set(row.venue_id, row.algorithm_score);
    }

    const voteCounts = new Map<number, number>();
    for (const row of (voteCountData ?? []) as unknown as VoteCountRow[]) {
      voteCounts.set(row.venue_id, Number(row.vote_count));
    }

    const totalVotes = Number(totalVoteData ?? 0);

    const topCaseByVenue = new Map<number, TopCaseRow>();
    for (const row of (topCaseData ?? []) as unknown as TopCaseRow[]) {
      topCaseByVenue.set(row.venue_id, row);
    }

    const caseCountByVenue = new Map<number, number>();
    const caseUpvoteSumByVenue = new Map<number, number>();
    for (const row of (caseCountData ?? []) as unknown as CaseCountRow[]) {
      caseCountByVenue.set(row.venue_id, Number(row.case_count));
      caseUpvoteSumByVenue.set(row.venue_id, Number(row.upvote_sum));
    }

    const venues = new Map<number, VenueRow>();
    for (const v of (venueData ?? []) as unknown as VenueRow[]) {
      venues.set(v.id, v);
    }

    // 4. Compute total scores and rank
    type ScoredVenue = {
      venueId: number;
      algorithmScore: number;
      voteCount: number;
      caseExists: boolean;
      caseUpvoteSum: number;
      totalScore: number;
    };

    const scoredVenues: ScoredVenue[] = [];
    for (const vid of nominatedVenueIds) {
      if (!venues.has(vid)) continue;
      const alg = scores.get(vid) ?? 0;
      const vc = voteCounts.get(vid) ?? 0;
      const hasCase = topCaseByVenue.has(vid);
      const caseUpvotes = caseUpvoteSumByVenue.get(vid) ?? 0;
      const total = alg + (vc * 1) + (hasCase ? 3 : 0) + (caseUpvotes * 0.5);
      scoredVenues.push({
        venueId: vid,
        algorithmScore: alg,
        voteCount: vc,
        caseExists: hasCase,
        caseUpvoteSum: caseUpvotes,
        totalScore: total,
      });
    }

    scoredVenues.sort((a, b) => b.totalScore - a.totalScore);
    const top50 = scoredVenues.slice(0, 50);

    // 5. Parallel batch: user vote + case author profiles + user upvotes
    const caseAuthorIds = new Set<string>();
    for (const sv of top50) {
      const tc = topCaseByVenue.get(sv.venueId);
      if (tc) caseAuthorIds.add(tc.user_id);
    }

    const topCaseIds = top50
      .map((sv) => topCaseByVenue.get(sv.venueId)?.id)
      .filter(Boolean) as string[];

    const [userVoteResult, profilesResult, upvotesResult] = await Promise.all([
      user
        ? supabase
            .from("best_of_votes")
            .select("venue_id")
            .eq("user_id", user.id)
            .eq("category_id", category.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      caseAuthorIds.size > 0
        ? supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", Array.from(caseAuthorIds))
        : Promise.resolve({ data: [] }),
      user && topCaseIds.length > 0
        ? supabase
            .from("best_of_case_upvotes")
            .select("case_id")
            .eq("user_id", user.id)
            .in("case_id", topCaseIds)
        : Promise.resolve({ data: [] }),
    ]);

    let userVoteVenueId: number | null = null;
    if (userVoteResult.data) {
      const votedVenueId = (userVoteResult.data as unknown as { venue_id: number }).venue_id;
      userVoteVenueId = venues.has(votedVenueId) ? votedVenueId : null;
    }

    const authorProfiles = new Map<string, ProfileRow>();
    for (const p of (profilesResult.data ?? []) as unknown as ProfileRow[]) {
      authorProfiles.set(p.id, p);
    }

    const userUpvotedCases = new Set<string>();
    for (const u of (upvotesResult.data ?? []) as unknown as { case_id: string }[]) {
      userUpvotedCases.add(u.case_id);
    }

    // 6. Build response
    const rankedVenues = top50.map((sv, index) => {
      const venue = venues.get(sv.venueId)!;
      const tc = topCaseByVenue.get(sv.venueId);
      const author = tc ? authorProfiles.get(tc.user_id) : null;

      return {
        venueId: sv.venueId,
        name: venue.name,
        slug: venue.slug,
        neighborhood: venue.neighborhood,
        imageUrl: venue.hero_image_url ?? venue.image_url,
        venueType: venue.venue_type,
        rank: index + 1,
        algorithmScore: sv.algorithmScore,
        voteCount: sv.voteCount,
        totalScore: Math.round(sv.totalScore * 10) / 10,
        topCase: tc ? {
          id: tc.id,
          content: tc.content,
          author: {
            id: tc.user_id,
            username: author?.username ?? "anonymous",
            avatarUrl: author?.avatar_url ?? null,
          },
          upvoteCount: tc.upvote_count,
          hasUpvoted: userUpvotedCases.has(tc.id),
        } : null,
        caseCount: caseCountByVenue.get(sv.venueId) ?? 0,
        hasVoted: sv.venueId === userVoteVenueId,
      };
    });

    // Conditional cache: private when authenticated, public when anonymous
    const cacheHeader = user
      ? "private, no-store"
      : "public, s-maxage=60, stale-while-revalidate=300";

    return NextResponse.json({
      category: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        isActive: true,
        sortOrder: category.sort_order,
      },
      venues: rankedVenues,
      userVoteVenueId,
      totalVotes,
    }, {
      headers: { "Cache-Control": cacheHeader },
    });
  } catch (error) {
    console.error("Best-of leaderboard error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
