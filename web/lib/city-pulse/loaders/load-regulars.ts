/**
 * Server loader for the RegularHangs feed section.
 *
 * Wraps `lib/server-regulars.ts` to match the FeedSection loader signature.
 * The underlying helper already implements the shared-cache-first / HTTP-
 * fallback strategy.
 */
import { getServerRegularsData } from "@/lib/server-regulars";
import type { FeedEventData } from "@/components/EventCard";
import type { FeedSectionContext } from "../feed-section-contract";

export interface RegularsFeedData {
  events: FeedEventData[];
}

export async function loadRegularsForFeed(
  ctx: FeedSectionContext,
): Promise<RegularsFeedData | null> {
  return getServerRegularsData(ctx.portalSlug);
}
