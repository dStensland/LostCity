// Family portal constants — activity taxonomy, filter config, etc.

// ---- Indoor / outdoor venue classification --------------------------------
// Mirrors the logic in database/migrations/521_venue_indoor_outdoor_classification.sql
// Used client-side to classify events by venue_type (which is already in the events API response).

const INDOOR_VENUE_TYPES = new Set([
  "museum", "gallery", "theater", "cinema", "library", "bowling",
  "arcade", "indoor_play", "trampoline_park", "escape_room",
  "shopping", "bar", "restaurant", "coffee", "studio", "gym",
  "clinic", "office", "school", "university", "coworking",
  "hotel", "retail", "ice_rink",
]);

const OUTDOOR_VENUE_TYPES = new Set([
  "park", "garden", "farm", "trail", "playground", "pool",
  "nature_preserve", "amphitheater", "sports_field", "beach",
  "campground", "golf_course", "skate_park", "boat_launch",
  "fishing_spot", "waterfall",
]);

const BOTH_VENUE_TYPES = new Set([
  "zoo", "aquarium", "theme_park", "recreation_center",
  "community_center", "brewery", "winery", "distillery",
  "botanical_garden", "historic_site", "fairground",
  "sports_complex", "performing_arts_center",
]);

export type VenueEnvironment = "indoor" | "outdoor" | "both" | null;

/** Classify a venue_type string into indoor/outdoor/both/null. */
export function classifyVenueEnvironment(venueType: string | null | undefined): VenueEnvironment {
  if (!venueType) return null;
  const t = venueType.toLowerCase();
  if (INDOOR_VENUE_TYPES.has(t)) return "indoor";
  if (OUTDOOR_VENUE_TYPES.has(t)) return "outdoor";
  if (BOTH_VENUE_TYPES.has(t)) return "both";
  return null;
}

/**
 * Returns true if the event's venue matches the requested environment filter.
 * "indoor" filter matches: indoor venues + 'both' venues (they have indoor space).
 * "outdoor" filter matches: outdoor venues + 'both' venues (they have outdoor space).
 * "both" filter matches only 'both' venues.
 * Unknown venue_type always passes through (don't exclude what we can't classify).
 */
export function matchesEnvironmentFilter(
  venueType: string | null | undefined,
  filter: "indoor" | "outdoor"
): boolean {
  const env = classifyVenueEnvironment(venueType);
  if (env === null) return true; // unknown — don't exclude
  if (filter === "indoor") return env === "indoor" || env === "both";
  if (filter === "outdoor") return env === "outdoor" || env === "both";
  return true;
}

/**
 * Returns true if current weather warrants showing a rainy-day indoor section.
 */
export function isRainyWeather(condition: string): boolean {
  const c = condition.toLowerCase();
  return c.includes("rain") || c.includes("shower") || c.includes("thunder") || c.includes("drizzle");
}

/**
 * Returns true if current weather warrants showing a "get outside" section.
 */
export function isSunnyWeather(condition: string, temp: number): boolean {
  const c = condition.toLowerCase();
  return (
    (c.includes("clear") || c.includes("sunny") || c.includes("partly")) &&
    temp >= 50 &&
    temp < 95
  );
}

export const ACTIVITY_TAGS = {
  sports: { label: "Sports", icon: "⚽", color: "#5E7A5E" },
  arts: { label: "Arts & Crafts", icon: "🎨", color: "#C48B1D" },
  stem: { label: "STEM", icon: "🔬", color: "#78B7D0" },
  nature: { label: "Nature", icon: "🌿", color: "#6B8E5E" },
  music: { label: "Music", icon: "🎵", color: "#9B7FB8" },
  theater: { label: "Theater", icon: "🎭", color: "#B54A3A" },
  cooking: { label: "Cooking", icon: "👨‍🍳", color: "#C67A52" },
  swimming: { label: "Swimming", icon: "🏊", color: "#78B7D0" },
  coding: { label: "Coding", icon: "💻", color: "#5B7AA5" },
  dance: { label: "Dance", icon: "💃", color: "#C48B1D" },
  gymnastics: { label: "Gymnastics", icon: "🤸", color: "#B54A3A" },
  general: { label: "General", icon: "⭐", color: "#756E63" },
} as const;

export type ActivityTagKey = keyof typeof ACTIVITY_TAGS;

export const ACTIVITY_TAG_KEYS = Object.keys(ACTIVITY_TAGS) as ActivityTagKey[];
