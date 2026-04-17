/**
 * Server loader for the shared City Pulse feed payload.
 *
 * Multiple islands (CityBriefing, LineupSection) consume slices of the same
 * underlying `/api/portals/<slug>/city-pulse` response. This loader wraps the
 * existing `getServerFeedData` helper — which reads from shared cache first
 * and falls back to HTTP — so the server shell can hand pre-loaded data to
 * each island as `initialData`.
 */
import { getServerFeedData } from "../server-feed";
import type { CityPulseResponse } from "../types";
import type { FeedSectionContext } from "../feed-section-contract";

export async function loadCityPulseForFeed(
  ctx: FeedSectionContext,
): Promise<CityPulseResponse | null> {
  return getServerFeedData(ctx.portalSlug);
}
