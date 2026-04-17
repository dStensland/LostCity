/**
 * Server loader for the ActiveContestSection.
 *
 * Fires the same two-step lookup the client performs — resolve the active
 * contest for the portal, then fetch its leaderboard — and shapes the result
 * so the section renders without any client fetches.
 */
import { logger } from "@/lib/logger";
import type { BestOfContest } from "@/lib/best-of-contests";
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("load-active-contest-timeout"),
    8000,
  );

  try {
    const activeRes = await fetch(
      `${baseUrl}/api/contests/active?portal=${encodeURIComponent(ctx.portalSlug)}`,
      { signal: controller.signal, next: { revalidate: 300 } },
    );
    if (!activeRes.ok) return null;
    const { contest } = (await activeRes.json()) as {
      contest: BestOfContest | null;
    };
    if (!contest) return null;

    const lbRes = await fetch(
      `${baseUrl}/api/contests/${encodeURIComponent(contest.slug)}?portal=${encodeURIComponent(ctx.portalSlug)}`,
      { signal: controller.signal, next: { revalidate: 300 } },
    );
    if (!lbRes.ok) return null;
    const lb = (await lbRes.json()) as {
      contest?: BestOfContest;
      venues?: Array<{
        name: string;
        neighborhood: string | null;
        imageUrl: string | null;
        voteCount: number;
      }>;
      totalVotes?: number;
    };

    const leader: Leader | null = lb.venues?.[0]
      ? {
          name: lb.venues[0].name,
          neighborhood: lb.venues[0].neighborhood,
          imageUrl: lb.venues[0].imageUrl,
          voteCount: lb.venues[0].voteCount,
        }
      : null;

    return {
      contest: lb.contest ?? contest,
      leader,
      totalVotes: lb.totalVotes ?? 0,
      venueCount: lb.venues?.length ?? 0,
    };
  } catch (err) {
    logger.error("load-active-contest failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
