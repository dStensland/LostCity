// Places to Go feed section — shared types

/** Config shape for each of the 12 categories. Defined statically in constants.ts. */
export interface PlacesToGoCategoryConfig {
  key: string;
  label: string;
  placeTypes: readonly string[];
  accentColor: string;
  iconType: string;
  /** Optional: which Find tab's "see all" link should point to (e.g. "eat-drink"). */
  seeAllTab?: string;
}

/** A single place card in an API response category. */
export interface PlacesToGoCard {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  neighborhood: string | null;
  is_open: boolean | null;
  /** Short, human-readable context strings shown on the card (e.g. "Free entry", "Open now"). */
  callouts: string[];
  event_count: number;
  href: string;
}

/** One category block in the API response. */
export interface PlacesToGoCategory {
  key: string;
  label: string;
  accent_color: string;
  icon_type: string;
  count: number;
  /** One-line editorial summary for the category (e.g. "12 parks and gardens in Atlanta"). */
  summary: string;
  has_activity_today: boolean;
  places: PlacesToGoCard[];
  see_all_href: string;
}

/** Top-level API response shape for /api/places-to-go. */
export interface PlacesToGoResponse {
  categories: PlacesToGoCategory[];
}

/**
 * Context object passed to scoring and callout functions for each place.
 * Aggregated from place_profile, place_vertical_details, and events data.
 */
export interface PlaceContext {
  // Weather suitability flags
  weatherMatchIndoor: boolean;
  weatherMatchOutdoor: boolean;

  // Contextual fit flags (used by scoring)
  weatherMatch: boolean;
  timeOfDayMatch: boolean;
  seasonMatch: boolean;

  // Activity counts
  eventsToday: number;
  eventsThisWeek: number;

  // Quality flags
  hasImage: boolean;
  hasDescription: boolean;
  isFeatured: boolean;

  // Callout data fields
  occasions: string[] | null;
  vibes: string[] | null;
  cuisine: string | null;
  neighborhood: string | null;
  nearestMarta: string | null;
  difficulty: string | null;
  driveTimeMinutes: number | null;
  bestSeasons: string[] | null;
  weatherFitTags: string[] | null;
  shortDescription: string | null;
  libraryPass: boolean | null;
  isNew: boolean;
  hasActiveSpecial: boolean;
  specialTitle: string | null;
  specialTimeEnd: string | null;
  indoorOutdoor: "indoor" | "outdoor" | "both" | null;
  createdDaysAgo: number | null;
  hasNewEventsThisWeek: boolean;
  todayEventTitle: string | null;
}
