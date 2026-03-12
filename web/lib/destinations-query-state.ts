import {
  getTabChips,
  getTabVenueTypes,
  isValidSpotsTab,
  SPOTS_TABS,
  type SpotsTab,
} from "@/lib/spots-constants";

export type DestinationsFilterState = {
  openNow: boolean;
  priceLevel: number[];
  venueTypes: string[];
  neighborhoods: string[];
  vibes: string[];
  cuisine: string[];
  withEvents: boolean;
  occasion: string | null;
};

export const DEFAULT_DESTINATIONS_FILTERS: DestinationsFilterState = {
  openNow: false,
  priceLevel: [],
  venueTypes: [],
  neighborhoods: [],
  vibes: [],
  cuisine: [],
  withEvents: false,
  occasion: null,
};

export type DestinationsQueryState = {
  activeTab: SpotsTab;
  filters: DestinationsFilterState;
};

function splitCsv(value: string | null): string[] {
  return (
    value
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) || []
  );
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function normalizeNumberArray(values: number[]): number[] {
  return Array.from(
    new Set(values.filter((value) => Number.isFinite(value)))
  ).sort((a, b) => a - b);
}

export function parseDestinationsFilterState(query: string): DestinationsFilterState {
  const params = new URLSearchParams(query);

  return {
    openNow: params.get("open_now") === "true",
    priceLevel: splitCsv(params.get("price_level"))
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)),
    venueTypes: splitCsv(params.get("venue_type") || params.get("venue_types")),
    neighborhoods: splitCsv(params.get("neighborhoods") || params.get("neighborhood")),
    vibes: splitCsv(params.get("vibes")),
    cuisine: splitCsv(params.get("cuisine")),
    withEvents: params.get("with_events") === "true",
    occasion: params.get("occasion") || null,
  };
}

export function inferDestinationsTab(
  filters: DestinationsFilterState,
  requestedTab: string | null,
): SpotsTab {
  if (isValidSpotsTab(requestedTab)) {
    return requestedTab;
  }

  if (filters.occasion) {
    const occasionTab = SPOTS_TABS.find((tab) =>
      getTabChips(tab.key).some((chip) => chip.key === filters.occasion)
    );
    if (occasionTab) {
      return occasionTab.key;
    }
  }

  if (filters.venueTypes.length > 0) {
    const matches = SPOTS_TABS.map((tab) => ({
      tab: tab.key,
      count: filters.venueTypes.filter((venueType) =>
        getTabVenueTypes(tab.key).includes(venueType)
      ).length,
    }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    if (matches[0]) {
      return matches[0].tab;
    }
  }

  return "eat-drink";
}

export function sanitizeDestinationsFilters(
  filters: DestinationsFilterState,
  activeTab: SpotsTab,
): DestinationsFilterState {
  const allowedVenueTypes = new Set(getTabVenueTypes(activeTab));
  const allowedOccasions = new Set(getTabChips(activeTab).map((chip) => chip.key));

  return {
    openNow: filters.openNow,
    priceLevel: normalizeNumberArray(filters.priceLevel),
    venueTypes: normalizeStringArray(
      filters.venueTypes.filter((venueType) => allowedVenueTypes.has(venueType))
    ),
    neighborhoods: normalizeStringArray(filters.neighborhoods),
    vibes: normalizeStringArray(filters.vibes),
    cuisine: normalizeStringArray(filters.cuisine),
    withEvents: filters.withEvents,
    occasion:
      filters.occasion && allowedOccasions.has(filters.occasion)
        ? filters.occasion
        : null,
  };
}

export function parseDestinationsQueryState(query: string): DestinationsQueryState {
  const params = new URLSearchParams(query);
  const parsedFilters = parseDestinationsFilterState(query);
  const activeTab = inferDestinationsTab(parsedFilters, params.get("tab"));

  return {
    activeTab,
    filters: sanitizeDestinationsFilters(parsedFilters, activeTab),
  };
}

export function areDestinationFiltersEqual(
  left: DestinationsFilterState,
  right: DestinationsFilterState,
): boolean {
  return (
    left.openNow === right.openNow &&
    left.withEvents === right.withEvents &&
    left.occasion === right.occasion &&
    JSON.stringify(normalizeNumberArray(left.priceLevel)) ===
      JSON.stringify(normalizeNumberArray(right.priceLevel)) &&
    JSON.stringify(normalizeStringArray(left.venueTypes)) ===
      JSON.stringify(normalizeStringArray(right.venueTypes)) &&
    JSON.stringify(normalizeStringArray(left.neighborhoods)) ===
      JSON.stringify(normalizeStringArray(right.neighborhoods)) &&
    JSON.stringify(normalizeStringArray(left.vibes)) ===
      JSON.stringify(normalizeStringArray(right.vibes)) &&
    JSON.stringify(normalizeStringArray(left.cuisine)) ===
      JSON.stringify(normalizeStringArray(right.cuisine))
  );
}

export function applyDestinationsQueryState(
  currentParams: URLSearchParams,
  state: DestinationsQueryState,
): URLSearchParams {
  const nextParams = new URLSearchParams(currentParams.toString());
  const filters = sanitizeDestinationsFilters(state.filters, state.activeTab);
  const setOrDelete = (key: string, value: string | null) => {
    if (value && value.length > 0) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
  };

  nextParams.set("view", "find");
  nextParams.set("type", "destinations");
  setOrDelete("tab", state.activeTab !== "eat-drink" ? state.activeTab : null);
  setOrDelete("occasion", filters.occasion);
  setOrDelete("open_now", filters.openNow ? "true" : null);
  setOrDelete("with_events", filters.withEvents ? "true" : null);
  setOrDelete(
    "price_level",
    filters.priceLevel.length > 0 ? normalizeNumberArray(filters.priceLevel).join(",") : null,
  );
  setOrDelete(
    "venue_type",
    filters.venueTypes.length > 0 ? normalizeStringArray(filters.venueTypes).join(",") : null,
  );
  setOrDelete(
    "neighborhoods",
    filters.neighborhoods.length > 0
      ? normalizeStringArray(filters.neighborhoods).join(",")
      : null,
  );
  nextParams.delete("neighborhood");
  setOrDelete(
    "vibes",
    filters.vibes.length > 0 ? normalizeStringArray(filters.vibes).join(",") : null,
  );
  setOrDelete(
    "cuisine",
    filters.cuisine.length > 0 ? normalizeStringArray(filters.cuisine).join(",") : null,
  );
  nextParams.delete("page");

  return nextParams;
}
