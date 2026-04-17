/**
 * Lightweight contest summary for the feed's Active Contest card.
 *
 * Returns the active contest for a portal + its current leaderboard leader,
 * total votes, and venue count — enough for the card without pulling the
 * full leaderboard route's response. Both the `/api/contests/active` route
 * and the `load-active-contest` feed loader call this helper directly so
 * no self-HTTP round-trip is needed.
 */
import { createClient } from "@/lib/supabase/server";
import {
  mapContestRow,
  type BestOfContest,
} from "@/lib/best-of-contests";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";

export interface ContestFeedLeader {
  name: string;
  neighborhood: string | null;
  imageUrl: string | null;
  voteCount: number;
}

export interface ContestFeedSummary {
  contest: BestOfContest;
  leader: ContestFeedLeader | null;
  totalVotes: number;
  venueCount: number;
}

export async function getActiveContestForPortal(
  portalSlug: string,
): Promise<BestOfContest | null> {
  const supabase = await createClient();
  const search = new URLSearchParams({ portal: portalSlug });
  const ctx = await resolvePortalQueryContext(supabase, search);
  if (!ctx.portalId) return null;

  const { data } = await supabase
    .from("best_of_contests")
    .select(
      "id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at",
    )
    .eq("portal_id", ctx.portalId)
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapContestRow(data as Record<string, unknown>) : null;
}

export async function getContestFeedSummary(
  portalSlug: string,
): Promise<ContestFeedSummary | null> {
  const contest = await getActiveContestForPortal(portalSlug);
  if (!contest) return null;

  const supabase = await createClient();

  // Approved nominations for the contest's category.
  const { data: nomData } = await supabase
    .from("best_of_nominations")
    .select("venue_id")
    .eq("category_id", contest.categoryId)
    .eq("status", "approved");

  const nominatedVenueIds = (nomData ?? []).map(
    (r) => Number((r as { venue_id: number }).venue_id),
  );

  if (nominatedVenueIds.length === 0) {
    return { contest, leader: null, totalVotes: 0, venueCount: 0 };
  }

  // Contest-window votes only.
  const { data: voteRows } = await supabase
    .from("best_of_votes")
    .select("venue_id")
    .eq("category_id", contest.categoryId)
    .in("place_id", nominatedVenueIds)
    .gte("created_at", contest.startsAt)
    .lte("created_at", contest.endsAt);

  const voteCounts = new Map<number, number>();
  for (const row of (voteRows ?? []) as { venue_id: number }[]) {
    voteCounts.set(row.venue_id, (voteCounts.get(row.venue_id) ?? 0) + 1);
  }

  const totalVotes = Array.from(voteCounts.values()).reduce(
    (sum, c) => sum + c,
    0,
  );

  // Pick the leader by highest vote count (ties broken by insertion order).
  let leaderVenueId: number | null = null;
  let leaderCount = -1;
  for (const [vid, count] of voteCounts) {
    if (count > leaderCount) {
      leaderCount = count;
      leaderVenueId = vid;
    }
  }

  if (leaderVenueId === null) {
    return {
      contest,
      leader: null,
      totalVotes,
      venueCount: nominatedVenueIds.length,
    };
  }

  const { data: venueData } = await supabase
    .from("places")
    .select("name, neighborhood, image_url, hero_image_url")
    .eq("id", leaderVenueId)
    .maybeSingle();

  const venueRow = venueData as {
    name: string;
    neighborhood: string | null;
    image_url: string | null;
    hero_image_url: string | null;
  } | null;

  const leader: ContestFeedLeader | null = venueRow
    ? {
        name: venueRow.name,
        neighborhood: venueRow.neighborhood,
        imageUrl: venueRow.hero_image_url ?? venueRow.image_url,
        voteCount: leaderCount,
      }
    : null;

  return {
    contest,
    leader,
    totalVotes,
    venueCount: nominatedVenueIds.length,
  };
}
