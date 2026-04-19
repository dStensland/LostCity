import "server-only";

import type { NeighborhoodsLaneInitialData } from "@/lib/explore-platform/lane-data";
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import { buildNeighborhoodIndexSections } from "@/lib/neighborhood-index";
import {
  getNeighborhoodsActivity,
  getVenueCountsByNeighborhood,
} from "@/lib/neighborhoods/loaders";

/**
 * Server loader for the Explore Neighborhoods lane.
 *
 * Pre-fetches activity data + venue counts + tier sections on the server so
 * the lane's initial paint doesn't wait on a client fetch. Matches the
 * pattern used by other lanes (places, events, shows, etc.).
 */
export async function getExploreNeighborhoodsInitialData({
  portalId,
}: ExploreLaneServerLoaderArgs): Promise<NeighborhoodsLaneInitialData> {
  const [counts, activityData] = await Promise.all([
    getVenueCountsByNeighborhood(),
    getNeighborhoodsActivity(portalId),
  ]);
  const sections = buildNeighborhoodIndexSections(counts);

  const tonightNeighborhoodCount = activityData.filter(
    (a) => a.eventsTodayCount > 0,
  ).length;
  const weekNeighborhoodCount = activityData.filter(
    (a) => a.eventsWeekCount > 0,
  ).length;

  // Serialize sections to a plain tier shape (strip Neighborhood config
  // beyond what the lane component needs — slug, name, tier) so the payload
  // stays small and JSON-serializable across the server→client boundary.
  const tierSections = sections.map((section) => ({
    title: section.title,
    neighborhoods: section.neighborhoods.map(({ neighborhood, count }) => ({
      id: neighborhood.id,
      name: neighborhood.name,
      count,
    })),
  }));

  return {
    activityData,
    tierSections,
    tonightNeighborhoodCount,
    weekNeighborhoodCount,
  };
}
