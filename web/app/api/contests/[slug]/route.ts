import { NextRequest, NextResponse } from "next/server";
import { withOptionalAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { mapContestRow, formatTimeRemaining } from "@/lib/best-of-contests";

type ContestRow = {
  id: string;
  category_id: string;
  portal_id: string;
  slug: string;
  title: string;
  prompt: string | null;
  description: string | null;
  cover_image_url: string | null;
  accent_color: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  winner_venue_id: number | null;
  winner_snapshot: unknown;
  winner_announced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryRow = { id: string; name: string };

type VenueRow = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  image_url: string | null;
  hero_image_url: string | null;
  place_type: string | null;
};

type VoteRow = { venue_id: number };
type CaseRow = {
  id: string;
  user_id: string;
  venue_id: number;
  content: string;
  upvote_count: number;
};
type ProfileRow = { id: string; username: string | null; avatar_url: string | null };

/**
 * GET /api/contests/[slug]
 * Public contest leaderboard — contest-scoped scoring only
 * Query: ?portal=atlanta
 * Cache: public s-maxage=30 for anonymous, private no-store for authenticated
 */
export const GET = withOptionalAuth(async (request: NextRequest, { user, supabase }) => {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);

    // Extract slug from URL path
    const pathname = new URL(request.url).pathname;
    const slug = pathname.split("/api/contests/")[1]?.split("/")[0];

    if (!slug) {
      return NextResponse.json({ error: "Missing contest slug" }, { status: 400 });
    }

    const ctx = await resolvePortalQueryContext(supabase, searchParams);
    if (!ctx.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // 1. Look up the contest by slug + portal
    const { data: contestData, error: contestError } = await supabase
      .from("best_of_contests")
      .select("id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at")
      .eq("slug", slug)
      .eq("portal_id", ctx.portalId)
      .in("status", ["active", "completed"])
      .maybeSingle();

    if (contestError) {
      console.error("Contest fetch error:", contestError);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    if (!contestData) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const contestRow = contestData as ContestRow;
    const contest = mapContestRow(contestRow as Record<string, unknown>);

    // 2. Look up category name
    const { data: catData } = await supabase
      .from("best_of_categories")
      .select("id, name")
      .eq("id", contest.categoryId)
      .maybeSingle();

    const category = catData as CategoryRow | null;

    // 3. Fetch approved nominations for this category
    const { data: nomData } = await supabase
      .from("best_of_nominations")
      .select("venue_id")
      .eq("category_id", contest.categoryId)
      .eq("status", "approved");

    const nominatedVenueIds = (nomData ?? []).map((r) => Number((r as { venue_id: number }).venue_id));

    if (nominatedVenueIds.length === 0) {
      return NextResponse.json({
        contest,
        categoryName: category?.name ?? null,
        venues: [],
        userVoteVenueId: null,
        totalVotes: 0,
        timeRemaining: formatTimeRemaining(contest.endsAt),
      }, {
        headers: { "Cache-Control": user ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    const startsAt = contest.startsAt;
    const endsAt = contest.endsAt;

    // 4. Contest-scoped parallel batch: votes, cases, venues
    const [
      { data: voteRows },
      { data: caseRows },
      { data: venueData },
    ] = await Promise.all([
      // Only votes cast within the contest window
      supabase
        .from("best_of_votes")
        .select("venue_id")
        .eq("category_id", contest.categoryId)
        .in("place_id", nominatedVenueIds)
        .gte("created_at", startsAt)
        .lte("created_at", endsAt),

      // Only cases submitted within the contest window, best first
      supabase
        .from("best_of_cases")
        .select("id, user_id, place_id, content, upvote_count")
        .eq("category_id", contest.categoryId)
        .in("place_id", nominatedVenueIds)
        .gte("created_at", startsAt)
        .lte("created_at", endsAt)
        .order("upvote_count", { ascending: false }),

      // Venue metadata
      supabase
        .from("places")
        .select("id, name, slug, neighborhood, image_url, hero_image_url, place_type")
        .in("id", nominatedVenueIds)
        .eq("is_active", true),
    ]);

    // Build score maps
    const voteCounts = new Map<number, number>();
    for (const row of (voteRows ?? []) as VoteRow[]) {
      voteCounts.set(row.venue_id, (voteCounts.get(row.venue_id) ?? 0) + 1);
    }

    const casesByVenue = new Map<number, CaseRow[]>();
    const topCaseByVenue = new Map<number, CaseRow>();
    for (const row of (caseRows ?? []) as unknown as CaseRow[]) {
      const existing = casesByVenue.get(row.venue_id) ?? [];
      existing.push(row);
      casesByVenue.set(row.venue_id, existing);
      if (!topCaseByVenue.has(row.venue_id)) {
        topCaseByVenue.set(row.venue_id, row);
      }
    }

    const venues = new Map<number, VenueRow>();
    for (const v of (venueData ?? []) as unknown as VenueRow[]) {
      venues.set(v.id, v);
    }

    // 5. Score all venues — pure community signal only (NO algorithm score)
    type ScoredEntry = {
      venueId: number;
      voteCount: number;
      caseCount: number;
      caseUpvoteSum: number;
      totalScore: number;
    };

    const scored: ScoredEntry[] = [];
    for (const vid of nominatedVenueIds) {
      if (!venues.has(vid)) continue;
      const vc = voteCounts.get(vid) ?? 0;
      const cases = casesByVenue.get(vid) ?? [];
      const caseCount = cases.length;
      const caseUpvoteSum = cases.reduce((sum, c) => sum + (c.upvote_count ?? 0), 0);
      const total = vc + (caseCount > 0 ? 3 : 0) + (caseUpvoteSum * 0.5);
      scored.push({ venueId: vid, voteCount: vc, caseCount, caseUpvoteSum, totalScore: total });
    }

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const top50 = scored.slice(0, 50);

    // 6. Resolve case authors + user vote (parallel)
    const caseAuthorIds = new Set<string>();
    for (const entry of top50) {
      const tc = topCaseByVenue.get(entry.venueId);
      if (tc) caseAuthorIds.add(tc.user_id);
    }

    const topCaseIds = top50
      .map((e) => topCaseByVenue.get(e.venueId)?.id)
      .filter(Boolean) as string[];

    const [userVoteResult, profilesResult, upvotesResult] = await Promise.all([
      user
        ? supabase
            .from("best_of_votes")
            .select("venue_id")
            .eq("user_id", user.id)
            .eq("category_id", contest.categoryId)
            .gte("created_at", startsAt)
            .lte("created_at", endsAt)
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
      const vd = (userVoteResult.data as unknown as { venue_id: number }).venue_id;
      userVoteVenueId = venues.has(vd) ? vd : null;
    }

    const authorProfiles = new Map<string, ProfileRow>();
    for (const p of ((profilesResult.data ?? []) as unknown as ProfileRow[])) {
      authorProfiles.set(p.id, p);
    }

    const userUpvotedCases = new Set<string>();
    for (const u of ((upvotesResult.data ?? []) as unknown as { case_id: string }[])) {
      userUpvotedCases.add(u.case_id);
    }

    const totalVotes = Array.from(voteCounts.values()).reduce((sum, c) => sum + c, 0);

    // 7. Build response
    const rankedVenues = top50.map((entry, index) => {
      const venue = venues.get(entry.venueId)!;
      const tc = topCaseByVenue.get(entry.venueId);
      const author = tc ? authorProfiles.get(tc.user_id) : null;

      return {
        venueId: entry.venueId,
        name: venue.name,
        slug: venue.slug,
        neighborhood: venue.neighborhood,
        imageUrl: venue.hero_image_url ?? venue.image_url,
        venueType: venue.place_type,
        rank: index + 1,
        voteCount: entry.voteCount,
        caseCount: entry.caseCount,
        totalScore: Math.round(entry.totalScore * 10) / 10,
        topCase: tc
          ? {
              id: tc.id,
              content: tc.content,
              author: {
                id: tc.user_id,
                username: author?.username ?? "anonymous",
                avatarUrl: author?.avatar_url ?? null,
              },
              upvoteCount: tc.upvote_count,
              hasUpvoted: userUpvotedCases.has(tc.id),
            }
          : null,
        hasVoted: entry.venueId === userVoteVenueId,
      };
    });

    const cacheHeader = user
      ? "private, no-store"
      : "public, s-maxage=30, stale-while-revalidate=60";

    return NextResponse.json({
      contest,
      categoryName: category?.name ?? null,
      venues: rankedVenues,
      userVoteVenueId,
      totalVotes,
      timeRemaining: formatTimeRemaining(contest.endsAt),
    }, {
      headers: { "Cache-Control": cacheHeader },
    });
  } catch (error) {
    console.error("Contest leaderboard error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
