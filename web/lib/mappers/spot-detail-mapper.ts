import type { SpotDetailPayload } from "@/lib/spot-detail";
import type { SpotApiResponse } from "@/components/views/PlaceDetailView";

/**
 * Maps server-side SpotDetailPayload to the client view's SpotApiResponse.
 * The shapes are runtime-compatible — this is primarily a type bridge.
 *
 * Key notes:
 * - SpotDetailPayload.spot is Record<string, unknown> from a DB select("*"),
 *   which includes both `venue_type` and `spot_type` columns.
 * - SpotDetailPayload.nearbyDestinations uses `venue_type`; NearbySection
 *   reads `spot.spot_type || spot.venue_type` so the fallback handles it.
 * - The `artifacts` alias maps to SpotApiResponse["artifacts"] for older
 *   consumers still referencing the previous field name.
 */
export function mapSpotDetailToViewData(detail: SpotDetailPayload): SpotApiResponse {
  return {
    spot: detail.spot as SpotApiResponse["spot"],
    upcomingEvents: detail.upcomingEvents as SpotApiResponse["upcomingEvents"],
    screenings: detail.screenings as SpotApiResponse["screenings"],
    nearbyDestinations: detail.nearbyDestinations as unknown as SpotApiResponse["nearbyDestinations"],
    highlights: detail.highlights as SpotApiResponse["highlights"],
    features: detail.features as SpotApiResponse["features"],
    specials: detail.specials as SpotApiResponse["specials"],
    editorialMentions: detail.editorialMentions as SpotApiResponse["editorialMentions"],
    occasions: detail.occasions as SpotApiResponse["occasions"],
    exhibitions: detail.exhibitions as SpotApiResponse["exhibitions"],
    attachedChildDestinations: detail.attachedChildDestinations as SpotApiResponse["attachedChildDestinations"],
    artifacts: detail.artifacts as SpotApiResponse["artifacts"],
    walkableNeighbors: detail.walkableNeighbors as SpotApiResponse["walkableNeighbors"],
  };
}
