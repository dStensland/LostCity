export type FindType = "events" | "classes" | "destinations" | "showtimes";

export const FIND_TYPE_FILTER_KEYS: Record<FindType, readonly string[]> = {
  events: [
    "search",
    "categories",
    "subcategories",
    "genres",
    "tags",
    "vibes",
    "neighborhoods",
    "price",
    "free",
    "date",
    "mood",
    "venue",
  ],
  classes: [
    "class_category",
    "class_date",
    "class_skill",
    "skill_level",
    "start_date",
    "end_date",
  ],
  destinations: [
    "search",
    "open_now",
    "with_events",
    "price_level",
    "venue_type",
    "neighborhoods",
    "neighborhood",
    "vibes",
    "genres",
  ],
  showtimes: ["date", "theater"],
};

const FIND_VIEW_STATE_KEYS = [
  "display",
  "density",
  "page",
  "map_bounds",
  "sw_lat",
  "sw_lng",
  "ne_lat",
  "ne_lng",
] as const;

export const FIND_FILTER_RESET_KEYS: readonly string[] = Array.from(
  new Set([
    ...FIND_TYPE_FILTER_KEYS.events,
    ...FIND_TYPE_FILTER_KEYS.classes,
    ...FIND_TYPE_FILTER_KEYS.destinations,
    ...FIND_TYPE_FILTER_KEYS.showtimes,
    ...FIND_VIEW_STATE_KEYS,
  ])
);

export const SHOWTIMES_EXCLUDED_FILTER_KEYS: readonly string[] = FIND_FILTER_RESET_KEYS.filter(
  (key) => key !== "date"
);

type SearchParamsLike = { get: (key: string) => string | null };
type SearchParamRecord = Record<string, unknown>;

function readParamValue(
  params: SearchParamsLike | SearchParamRecord,
  key: string
): string | null {
  if (typeof (params as SearchParamsLike).get === "function") {
    return (params as SearchParamsLike).get(key);
  }

  const value = (params as SearchParamRecord)[key];
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : null;
  }
  return typeof value === "string" ? value : null;
}

export function hasActiveFindFilters(
  params: SearchParamsLike | SearchParamRecord,
  findType: FindType
): boolean {
  return FIND_TYPE_FILTER_KEYS[findType].some((key) => {
    const value = readParamValue(params, key);
    return Boolean(value && value.trim().length > 0);
  });
}
