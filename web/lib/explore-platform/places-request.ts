import {
  getTabChips,
  getTabVenueTypes,
  type SpotsTab,
} from "@/lib/spots-constants";
import { parseDestinationsQueryState } from "@/lib/destinations-query-state";

export type ExplorePlacesRequestOptions = {
  portalId: string;
  isExclusive: boolean;
  queryString: string;
  userLocation?: { lat: number; lng: number } | null;
  limit?: number;
};

export function buildExplorePlacesRequestParams({
  portalId,
  isExclusive,
  queryString,
  userLocation,
  limit,
}: ExplorePlacesRequestOptions): URLSearchParams {
  const { filters, activeTab } = parseDestinationsQueryState(queryString);
  const sourceParams = new URLSearchParams(queryString);
  const params = new URLSearchParams();

  if (portalId) params.set("portal_id", portalId);
  if (isExclusive) params.set("exclusive", "true");

  let effectiveVenueTypes = filters.venueTypes;
  let effectiveVibes = filters.vibes;
  let effectiveCuisine = filters.cuisine;

  if (effectiveVenueTypes.length === 0) {
    effectiveVenueTypes = getTabVenueTypes(activeTab);
  }

  if (filters.occasion) {
    const chip = getTabChips(activeTab).find((entry) => entry.key === filters.occasion);
    if (chip) {
      const overrides = chip.filterOverrides;
      if (overrides.venueTypes) effectiveVenueTypes = [...overrides.venueTypes];
      if (overrides.vibes) {
        effectiveVibes = [
          ...effectiveVibes,
          ...overrides.vibes.filter((value) => !effectiveVibes.includes(value)),
        ];
      }
      if (overrides.cuisine) {
        effectiveCuisine = [
          ...effectiveCuisine,
          ...overrides.cuisine.filter((value) => !effectiveCuisine.includes(value)),
        ];
      }
    }
  }

  if (effectiveVenueTypes.length > 0) {
    params.set("venue_type", effectiveVenueTypes.join(","));
  }
  if (activeTab === "things-to-do") {
    params.set("include_events", "true");
  }
  if (filters.neighborhoods.length > 0) {
    params.set("neighborhood", filters.neighborhoods.join(","));
  }
  if (effectiveVibes.length > 0) {
    params.set("vibes", effectiveVibes.join(","));
  }
  if (effectiveCuisine.length > 0) {
    params.set("cuisine", effectiveCuisine.join(","));
  }

  const urlSearch = sourceParams.get("search") || "";
  if (urlSearch) {
    params.set("q", urlSearch);
  }

  if (userLocation) {
    params.set("center_lat", String(userLocation.lat));
    params.set("center_lng", String(userLocation.lng));
  }

  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }

  params.set("compact", "1");

  return params;
}

export function getExplorePlacesActiveTab(queryString: string): SpotsTab {
  return parseDestinationsQueryState(queryString).activeTab;
}
