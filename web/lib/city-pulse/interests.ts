/**
 * Interest chip configuration for the Lineup feed filter.
 *
 * Users pick up to ~5 category chips from the full catalog.
 * "All" = union of active interests. "Happy Hour" = specials-only.
 * "Free" = cross-cutting tag filter.
 *
 * Chip selection persists to user_preferences.feed_layout.interests.
 */

import type { CityPulseEventItem } from "./types";

// ---------------------------------------------------------------------------
// Interest chip type
// ---------------------------------------------------------------------------

export type InterestType = "category" | "tag" | "specials";

export interface InterestChip {
  id: string;
  label: string;
  /** Phosphor icon name — resolved at render time in the component */
  iconName: string;
  /** Accent color for the active chip state */
  color: string;
  type: InterestType;
  /** Return true if the event matches this interest. Unused for "specials" type. */
  match: (item: CityPulseEventItem) => boolean;
}

// ---------------------------------------------------------------------------
// Default interest chips (shown on first load) — tight set of 5
// ---------------------------------------------------------------------------

export const DEFAULT_INTEREST_IDS = [
  "music",
  "comedy",
  "art",
  "food_drink",
  "nightlife",
] as const;

// ---------------------------------------------------------------------------
// Full interest catalog
// ---------------------------------------------------------------------------

const catMatch =
  (category: string) =>
  (item: CityPulseEventItem): boolean =>
    item.event.category === category;

const genreMatch =
  (...genres: string[]) =>
  (item: CityPulseEventItem): boolean => {
    const g = (item.event as Record<string, unknown>).genres;
    const t = (item.event as Record<string, unknown>).tags;
    return (
      (Array.isArray(g) && genres.some((x) => g.includes(x))) ||
      (Array.isArray(t) && genres.some((x) => t.includes(x)))
    );
  };

export const INTEREST_CHIPS: InterestChip[] = [
  // --- Default interests ---
  {
    id: "music",
    label: "Live Music",
    iconName: "Waveform",
    color: "#F9A8D4",
    type: "category",
    match: catMatch("music"),
  },
  {
    id: "comedy",
    label: "Comedy",
    iconName: "Smiley",
    color: "#FCD34D",
    type: "category",
    match: catMatch("comedy"),
  },
  {
    id: "art",
    label: "Art",
    iconName: "Palette",
    color: "#C4B5FD",
    type: "category",
    match: catMatch("art"),
  },
  {
    id: "food_drink",
    label: "Food & Drink",
    iconName: "Martini",
    color: "#FDBA74",
    type: "category",
    match: catMatch("food_drink"),
  },
  {
    id: "nightlife",
    label: "Going Out",
    iconName: "MoonStars",
    color: "#E879F9",
    type: "category",
    match: catMatch("nightlife"),
  },
  // --- Available via "+" picker ---
  {
    id: "film",
    label: "Movies",
    iconName: "FilmSlate",
    color: "#A5B4FC",
    type: "category",
    match: catMatch("film"),
  },
  {
    id: "sports",
    label: "Sports",
    iconName: "PersonSimpleRun",
    color: "#7DD3FC",
    type: "category",
    match: catMatch("sports"),
  },
  {
    id: "family",
    label: "Family",
    iconName: "UsersFour",
    color: "#A78BFA",
    type: "category",
    match: catMatch("family"),
  },
  {
    id: "theater",
    label: "Theater",
    iconName: "MaskHappy",
    color: "#F0ABFC",
    type: "category",
    match: catMatch("theater"),
  },
  {
    id: "fitness",
    label: "Fitness",
    iconName: "Barbell",
    color: "#5EEAD4",
    type: "category",
    match: catMatch("fitness"),
  },
  // --- Special chips ---
  {
    id: "happy_hour",
    label: "Happy Hour",
    iconName: "BeerStein",
    color: "var(--gold)",
    type: "specials",
    match: () => false,
  },
  {
    id: "free",
    label: "Free",
    iconName: "Ticket",
    color: "#34D399",
    type: "tag",
    match: (item) => {
      const tags = (item.event as Record<string, unknown>).tags;
      if (Array.isArray(tags)) return tags.includes("free");
      const isFree = (item.event as Record<string, unknown>).is_free;
      return isFree === true;
    },
  },
  // --- Extended ---
  {
    id: "community",
    label: "Community",
    iconName: "UsersThree",
    color: "#6EE7B7",
    type: "category",
    match: catMatch("community"),
  },
  {
    id: "learning",
    label: "Learning",
    iconName: "GraduationCap",
    color: "#A8E6CF",
    type: "category",
    match: catMatch("learning"),
  },
  {
    id: "wellness",
    label: "Wellness",
    iconName: "Leaf",
    color: "#99F6E4",
    type: "category",
    match: catMatch("wellness"),
  },
  {
    id: "dance",
    label: "Dance",
    iconName: "MusicNotes",
    color: "#F9A8D4",
    type: "category",
    match: catMatch("dance"),
  },
  {
    id: "outdoors",
    label: "Outdoors",
    iconName: "Mountains",
    color: "#BEF264",
    type: "category",
    match: catMatch("outdoors"),
  },
  {
    id: "markets",
    label: "Markets",
    iconName: "Warehouse",
    color: "#FCA5A5",
    type: "category",
    match: catMatch("markets"),
  },
  // --- Genre-based chips ---
  {
    id: "trivia",
    label: "Trivia Night",
    iconName: "Question",
    color: "#93C5FD",
    type: "category",
    match: genreMatch("trivia"),
  },
  {
    id: "karaoke",
    label: "Karaoke",
    iconName: "MicrophoneStage",
    color: "#F9A8D4",
    type: "category",
    match: genreMatch("karaoke"),
  },
  {
    id: "drag",
    label: "Drag Shows",
    iconName: "Crown",
    color: "#E879F9",
    type: "category",
    match: genreMatch("drag"),
  },
  {
    id: "open_mic",
    label: "Open Mic",
    iconName: "Microphone",
    color: "#FCD34D",
    type: "category",
    match: genreMatch("open-mic", "openmic"),
  },
  {
    id: "improv",
    label: "Improv",
    iconName: "Lightbulb",
    color: "#FDBA74",
    type: "category",
    match: genreMatch("improv"),
  },
  {
    id: "dj_electronic",
    label: "DJ / Electronic",
    iconName: "Headphones",
    color: "#C4B5FD",
    type: "category",
    match: genreMatch("dj", "electronic", "edm"),
  },
  // --- Additional category-based chips ---
  {
    id: "gaming",
    label: "Gaming",
    iconName: "GameController",
    color: "#7DD3FC",
    type: "category",
    match: catMatch("gaming"),
  },
  {
    id: "words",
    label: "Literary",
    iconName: "BookOpen",
    color: "#A8E6CF",
    type: "category",
    match: catMatch("words"),
  },
];

/** Map from interest ID to chip config */
export const INTEREST_MAP = new Map(INTEREST_CHIPS.map((c) => [c.id, c]));

/** All valid interest IDs */
export const ALL_INTEREST_IDS = INTEREST_CHIPS.map((c) => c.id);

/**
 * Build the "All" union matcher from a set of active interest IDs.
 * Matches any event that passes at least one active category/tag interest.
 */
export function buildUnionMatcher(
  activeIds: string[],
): (item: CityPulseEventItem) => boolean {
  const chips = activeIds
    .map((id) => INTEREST_MAP.get(id))
    .filter((c): c is InterestChip => !!c && c.type === "category");

  if (chips.length === 0) return () => true;

  return (item) => chips.some((c) => c.match(item));
}
