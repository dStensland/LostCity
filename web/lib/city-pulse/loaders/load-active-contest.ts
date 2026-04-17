/**
 * Server loader for the ActiveContestSection.
 *
 * Calls the shared `getContestFeedSummary` helper directly — no self-HTTP.
 * The helper runs the same active-contest lookup the route uses plus a
 * lightweight leaderboard summary (top venue + totals) instead of the full
 * leaderboard payload.
 */
import { logger } from "@/lib/logger";
import type { BestOfContest } from "@/lib/best-of-contests";
import { getContestFeedSummary } from "@/lib/contests/get-feed-summary";
import type { FeedSectionContext } from "../feed-section-contract";

interface Leader {
  name: string;
  neighborhood: string | null;
  imageUrl: string | null;
  voteCount: number;
}

export interface ActiveContestFeedData {
  contest: BestOfContest;
  leader: Leader | null;
  totalVotes: number;
  venueCount: number;
}

export async function loadActiveContestForFeed(
  ctx: FeedSectionContext,
): Promise<ActiveContestFeedData | null> {
  try {
    const summary = await getContestFeedSummary(ctx.portalSlug);
    if (!summary) return null;
    return summary;
  } catch (err) {
    logger.error("load-active-contest failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
