import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminErrorResponse,
  isValidUUID,
  type AnySupabase,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { mapContestRow, type WinnerSnapshot } from "@/lib/best-of-contests";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; contestId: string }>;
};

type ContestRow = {
  id: string;
  category_id: string;
  portal_id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  winner_venue_id: number | null;
};

type VenueRow = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  image_url: string | null;
  hero_image_url: string | null;
  place_type: string | null;
};

type VoteCountRow = { venue_id: number; vote_count: number };
type CaseCountRow = { venue_id: number; case_count: number; upvote_sum: number };
type TopCaseRow = {
  id: string;
  user_id: string;
  venue_id: number;
  content: string;
  upvote_count: number;
};
type ProfileRow = { id: string; username: string | null; avatar_url: string | null };

async function requirePortalAccess(portalId: string, context: string) {
  if (!isValidUUID(portalId)) {
    return { response: NextResponse.json({ error: "Invalid portal id" }, { status: 400 }) };
  }

  if (!(await canManagePortal(portalId))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data: portal, error } = await db
    .from("portals")
    .select("id, slug, name")
    .eq("id", portalId)
    .maybeSingle();

  if (error) {
    return { response: adminErrorResponse(error, context), db };
  }

  if (!portal) {
    return { response: NextResponse.json({ error: "Portal not found" }, { status: 404 }), db };
  }

  return { db, portal };
}

/**
 * POST /api/admin/portals/[id]/contests/[contestId]/complete
 *
 * Completes a contest by:
 * 1. Fetching all approved nominations for the contest category
 * 2. Computing contest-scoped scores (only votes/cases within the contest window)
 * 3. Snapshotting top 10 venues with winner details
 * 4. Setting winner_venue_id, winner_snapshot, winner_announced_at, status='completed'
 *
 * Only allowed when contest is in 'active' or 'draft' status (not already completed/archived).
 */
export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, contestId } = await params;
  const access = await requirePortalAccess(portalId, "POST /api/admin/portals/[id]/contests/[contestId]/complete (portal)");
  if (access.response) return access.response;
  const { db } = access;

  if (!isValidUUID(contestId)) {
    return NextResponse.json({ error: "Invalid contest id" }, { status: 400 });
  }

  // 1. Fetch the contest
  const { data: contestData, error: contestError } = await db
    .from("best_of_contests")
    .select("id, category_id, portal_id, slug, title, starts_at, ends_at, status, winner_venue_id")
    .eq("id", contestId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (contestError) {
    return adminErrorResponse(contestError, "POST /api/admin/portals/[id]/contests/[contestId]/complete (fetch contest)");
  }
  if (!contestData) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const contest = contestData as ContestRow;

  if (contest.status === 'completed') {
    return NextResponse.json({ error: "Contest is already completed" }, { status: 409 });
  }
  if (contest.status === 'archived') {
    return NextResponse.json({ error: "Cannot complete an archived contest" }, { status: 409 });
  }

  const startsAt = contest.starts_at;
  const endsAt = contest.ends_at;

  // 2. Fetch approved nominations for this category
  const { data: nomData, error: nomError } = await db
    .from("best_of_nominations")
    .select("venue_id")
    .eq("category_id", contest.category_id)
    .eq("status", "approved");

  if (nomError) {
    return adminErrorResponse(nomError, "POST /api/admin/portals/[id]/contests/[contestId]/complete (nominations)");
  }

  const nominatedVenueIds = (nomData ?? []).map((r) => Number((r as { venue_id: number }).venue_id));

  if (nominatedVenueIds.length === 0) {
    return NextResponse.json({ error: "No approved nominations found for this contest category" }, { status: 422 });
  }

  // 3. Contest-scoped scoring: only count votes and cases within the contest window
  const [
    { data: voteRows, error: voteError },
    { data: caseRows, error: caseError },
    { data: venueData, error: venueError },
  ] = await Promise.all([
    // Votes cast during the contest window
    db
      .from("best_of_votes")
      .select("venue_id")
      .eq("category_id", contest.category_id)
      .in("place_id", nominatedVenueIds)
      .gte("created_at", startsAt)
      .lte("created_at", endsAt),

    // Cases submitted during the contest window
    db
      .from("best_of_cases")
      .select("id, user_id, place_id, content, upvote_count")
      .eq("category_id", contest.category_id)
      .in("place_id", nominatedVenueIds)
      .gte("created_at", startsAt)
      .lte("created_at", endsAt)
      .order("upvote_count", { ascending: false }),

    // Venue metadata
    db
      .from("places")
      .select("id, name, slug, neighborhood, image_url, hero_image_url, place_type")
      .in("id", nominatedVenueIds)
      .eq("is_active", true),
  ]);

  if (voteError) {
    return adminErrorResponse(voteError, "POST /api/admin/portals/[id]/contests/[contestId]/complete (votes)");
  }
  if (caseError) {
    return adminErrorResponse(caseError, "POST /api/admin/portals/[id]/contests/[contestId]/complete (cases)");
  }
  if (venueError) {
    return adminErrorResponse(venueError, "POST /api/admin/portals/[id]/contests/[contestId]/complete (venues)");
  }

  // Build score maps from contest-window data
  const voteCounts = new Map<number, number>();
  for (const row of (voteRows ?? []) as unknown as { venue_id: number }[]) {
    voteCounts.set(row.venue_id, (voteCounts.get(row.venue_id) ?? 0) + 1);
  }

  const casesByVenue = new Map<number, TopCaseRow[]>();
  const topCaseByVenue = new Map<number, TopCaseRow>();
  for (const row of (caseRows ?? []) as unknown as TopCaseRow[]) {
    const existing = casesByVenue.get(row.venue_id) ?? [];
    existing.push(row);
    casesByVenue.set(row.venue_id, existing);
    // Already ordered by upvote_count DESC, so first entry per venue = top case
    if (!topCaseByVenue.has(row.venue_id)) {
      topCaseByVenue.set(row.venue_id, row);
    }
  }

  const venues = new Map<number, VenueRow>();
  for (const v of (venueData ?? []) as unknown as VenueRow[]) {
    venues.set(v.id, v);
  }

  // 4. Compute contest scores — NO algorithm score, pure community signal only
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
    // Score formula: votes + caseBonus (3 if has any case) + caseUpvotes * 0.5
    const total = vc + (caseCount > 0 ? 3 : 0) + (caseUpvoteSum * 0.5);
    scored.push({ venueId: vid, voteCount: vc, caseCount, caseUpvoteSum, totalScore: total });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);

  if (scored.length === 0) {
    return NextResponse.json({ error: "No active venues found for this contest" }, { status: 422 });
  }

  // 5. Resolve author profiles for top 10 venue cases
  const top10 = scored.slice(0, 10);
  const caseAuthorIds = new Set<string>();
  for (const entry of top10) {
    const tc = topCaseByVenue.get(entry.venueId);
    if (tc) caseAuthorIds.add(tc.user_id);
  }

  const authorProfiles = new Map<string, ProfileRow>();
  if (caseAuthorIds.size > 0) {
    const { data: profileData } = await db
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", Array.from(caseAuthorIds));

    for (const p of (profileData ?? []) as unknown as ProfileRow[]) {
      authorProfiles.set(p.id, p);
    }
  }

  const totalContestVotes = Array.from(voteCounts.values()).reduce((sum, c) => sum + c, 0);

  // 6. Build the winner snapshot
  const winner = scored[0];
  const winnerVenue = venues.get(winner.venueId)!;
  const winnerTopCase = topCaseByVenue.get(winner.venueId);
  const winnerCaseAuthor = winnerTopCase ? authorProfiles.get(winnerTopCase.user_id) : null;

  const runnerUp = scored.length > 1 ? scored[1] : null;
  const runnerUpVenue = runnerUp ? venues.get(runnerUp.venueId) : null;

  const winnerSnapshot: WinnerSnapshot = {
    venueId: winner.venueId,
    name: winnerVenue.name,
    slug: winnerVenue.slug,
    neighborhood: winnerVenue.neighborhood,
    imageUrl: winnerVenue.hero_image_url ?? winnerVenue.image_url,
    finalRank: 1,
    totalScore: Math.round(winner.totalScore * 10) / 10,
    voteCount: winner.voteCount,
    caseCount: winner.caseCount,
    topCaseContent: winnerTopCase?.content ?? null,
    topCaseAuthor: winnerCaseAuthor?.username ?? null,
    runnerUp: runnerUp && runnerUpVenue
      ? {
          venueId: runnerUp.venueId,
          name: runnerUpVenue.name,
          totalScore: Math.round(runnerUp.totalScore * 10) / 10,
        }
      : null,
    totalContestVotes,
    snapshotAt: new Date().toISOString(),
  };

  // 7. Persist completion
  const now = new Date().toISOString();
  const { data: updatedData, error: updateError } = await db
    .from("best_of_contests")
    .update({
      status: 'completed',
      winner_venue_id: winner.venueId,
      winner_snapshot: winnerSnapshot as unknown as never,
      winner_announced_at: now,
      updated_at: now,
    } as never)
    .eq("id", contestId)
    .eq("portal_id", portalId)
    .select("id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at")
    .maybeSingle();

  if (updateError) {
    return adminErrorResponse(updateError, "POST /api/admin/portals/[id]/contests/[contestId]/complete (update)");
  }
  if (!updatedData) {
    return NextResponse.json({ error: "Failed to complete contest" }, { status: 500 });
  }

  const completedContest = mapContestRow(updatedData as Record<string, unknown>);

  // 8. Return full leaderboard snapshot for the admin UI
  const leaderboard = top10.map((entry, index) => {
    const venue = venues.get(entry.venueId)!;
    const tc = topCaseByVenue.get(entry.venueId);
    const author = tc ? authorProfiles.get(tc.user_id) : null;

    return {
      rank: index + 1,
      venueId: entry.venueId,
      name: venue.name,
      slug: venue.slug,
      neighborhood: venue.neighborhood,
      imageUrl: venue.hero_image_url ?? venue.image_url,
      venueType: venue.place_type,
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
          }
        : null,
    };
  });

  return NextResponse.json({
    contest: completedContest,
    leaderboard,
    totalContestVotes,
  });
}
