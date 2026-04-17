/**
 * Server loader for the "Today in Atlanta" network-feed section.
 *
 * Calls the shared `fetchNetworkFeed` helper directly (no internal HTTP hop)
 * with the same shape the client component's initial request used.
 */
import { logger } from "@/lib/logger";
import { fetchNetworkFeed } from "@/lib/network-feed/fetch-network-feed";
import type { FeedSectionContext } from "../feed-section-contract";
import type { NetworkPost } from "@/components/feed/sections/NetworkFeedSection";

export interface NewsFeedData {
  posts: NetworkPost[];
}

export async function loadNewsForFeed(
  ctx: FeedSectionContext,
): Promise<NewsFeedData | null> {
  try {
    const outcome = await fetchNetworkFeed({
      portalSlug: ctx.portalSlug,
      limit: 60,
    });
    if (!outcome.ok) return null;
    return { posts: outcome.result.posts as unknown as NetworkPost[] };
  } catch (err) {
    logger.error("load-news failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
