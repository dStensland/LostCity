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
import { SPECTATOR_SPORTS_GENRES, RECREATION_SIGNAL_GENRES } from "./sports-signals";

// ---------------------------------------------------------------------------
// Interest chip type
// ---------------------------------------------------------------------------

export type InterestType = "category" | "tag";

export interface InterestChip {
  id: string;
  label: string;
  /** Phosphor icon name — resolved at render time in the component */
  iconName: string;
  /** Accent color for the active chip state */
  color: string;
  type: InterestType;
  /** Return true if the event matches this interest. */
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
  "games",
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

const spectatorSportsMatch = genreMatch(...SPECTATOR_SPORTS_GENRES);
const recreationSignalMatch = genreMatch(...RECREATION_SIGNAL_GENRES);
const DANCE_SIGNAL_GENRES = [
  "dance",
  "salsa",
  "swing",
  "line-dancing",
  "latin-night",
  "dance-party",
  "two-step",
  "bachata",
  "reggaeton",
  "cumbia",
  "country-dance",
  "salsa-night",
] as const;
const MARKET_SIGNAL_GENRES = [
  "farmers-market",
  "market",
  "night-market",
  "craft-market",
  "makers-market",
] as const;
const GAMING_SIGNAL_GENRES = [
  "gaming",
  "esports",
  "board-games",
  "arcade",
  "dnd",
  "video-games",
  "tabletop",
  "trading-card-games",
] as const;

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
    id: "games",
    label: "Games & Trivia",
    iconName: "GameController",
    color: "#E879F9",
    type: "category",
    match: catMatch("games"),
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
    label: "Game Day",
    iconName: "Trophy",
    color: "#7DD3FC",
    type: "category",
    match: (item) => catMatch("sports")(item) || spectatorSportsMatch(item),
  },
  {
    id: "fitness",
    label: "Fitness & Rec",
    iconName: "PersonSimpleRun",
    color: "#86EFAC",
    type: "category",
    match: (item) => catMatch("fitness")(item) || recreationSignalMatch(item),
  },
  {
    id: "workshops",
    label: "Workshops",
    iconName: "Toolbox",
    color: "#A78BFA",
    type: "category",
    match: catMatch("workshops"),
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
    id: "civic",
    label: "Civic",
    iconName: "Bank",
    color: "#5EEAD4",
    type: "category",
    match: catMatch("civic"),
  },
  // --- Special chips ---
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
    id: "education",
    label: "Education",
    iconName: "GraduationCap",
    color: "#A8E6CF",
    type: "category",
    match: catMatch("education"),
  },
  {
    id: "dance",
    label: "Dance",
    iconName: "MusicNotes",
    color: "#F9A8D4",
    type: "category",
    match: genreMatch(...DANCE_SIGNAL_GENRES),
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
    match: genreMatch(...MARKET_SIGNAL_GENRES),
  },
  // --- Genre-based chips ---
  {
    id: "food_specials",
    label: "Specials",
    iconName: "ForkKnife",
    color: "#FCD34D",
    type: "category",
    match: genreMatch("happy-hour", "food-specials", "specials", "oysters", "taco-tuesday", "wings", "drink-specials"),
  },
  {
    id: "run_fitness",
    label: "Run & Fitness",
    iconName: "PersonSimpleRun",
    color: "#5EEAD4",
    type: "category",
    match: genreMatch("run-club", "running", "cycling", "bike-ride", "yoga", "pickleball"),
  },
  {
    id: "bingo",
    label: "Bingo",
    iconName: "NumberCircleNine",
    color: "#FDBA74",
    type: "category",
    match: genreMatch("bingo"),
  },
  {
    id: "jazz_blues",
    label: "Jazz & Blues",
    iconName: "MusicNotes",
    color: "#93C5FD",
    type: "category",
    match: genreMatch("jazz", "blues", "jam-session"),
  },
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
    match: genreMatch(...GAMING_SIGNAL_GENRES),
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

/**
 * Map a chip ID to the server-side category_counts keys it should look up.
 * Category-based chips match their category directly (e.g. "music" → ["music"]).
 * Genre-based chips match genre:X and tag:X keys (e.g. "trivia" → ["genre:trivia", "tag:trivia"]).
 * "free" matches tag:free.
 */
const CHIP_COUNT_KEYS: Record<string, string[]> = {
  // Genre-based chips — check both genre: and tag: prefixed keys
  trivia: ["genre:trivia", "tag:trivia"],
  karaoke: ["genre:karaoke", "tag:karaoke"],
  drag: ["genre:drag", "tag:drag"],
  open_mic: ["genre:open-mic", "genre:openmic", "tag:open-mic", "tag:openmic"],
  improv: ["genre:improv", "tag:improv"],
  dj_electronic: ["genre:dj", "genre:electronic", "genre:edm", "tag:dj", "tag:electronic", "tag:edm"],
  food_specials: ["genre:happy-hour", "genre:food-specials", "genre:specials", "genre:oysters", "genre:taco-tuesday", "genre:wings", "genre:drink-specials", "tag:happy-hour", "tag:food-specials", "tag:specials", "tag:oysters", "tag:taco-tuesday", "tag:wings", "tag:drink-specials"],
  sports: SPECTATOR_SPORTS_GENRES.flatMap((genre) => [`genre:${genre}`, `tag:${genre}`]),
  fitness: RECREATION_SIGNAL_GENRES.flatMap((genre) => [`genre:${genre}`, `tag:${genre}`]),

  dance: DANCE_SIGNAL_GENRES.flatMap((genre) => [`genre:${genre}`, `tag:${genre}`]),
  markets: MARKET_SIGNAL_GENRES.flatMap((genre) => [`genre:${genre}`, `tag:${genre}`]),
  gaming: GAMING_SIGNAL_GENRES.flatMap((genre) => [`genre:${genre}`, `tag:${genre}`]),
  run_fitness: ["genre:run-club", "genre:running", "genre:cycling", "genre:bike-ride", "genre:yoga", "genre:pickleball", "tag:run-club", "tag:running", "tag:cycling", "tag:bike-ride", "tag:yoga", "tag:pickleball"],
  bingo: ["genre:bingo", "tag:bingo"],
  jazz_blues: ["genre:jazz", "genre:blues", "genre:jam-session", "tag:jazz", "tag:blues", "tag:jam-session"],
  // Tag-based chips
  free: ["tag:free"],
};

/**
 * Get the total server-side count for a chip from category_counts.
 * For category chips, returns counts[chipId] directly.
 * For genre/tag chips, sums across all matching keys.
 * Returns undefined if category_counts is not available.
 */
export function getServerChipCount(
  chipId: string,
  categoryCounts: Record<string, number> | undefined,
): number | undefined {
  if (!categoryCounts) return undefined;
  const keys = CHIP_COUNT_KEYS[chipId];
  if (keys) {
    // Genre/tag chip — sum across all matching keys (dedup not needed,
    // server counts genres and tags separately so same event may be counted
    // via both, but that's the correct behavior matching genreMatch())
    let total = 0;
    for (const k of keys) total += categoryCounts[k] || 0;
    return total;
  }
  // Category chip — direct lookup
  return categoryCounts[chipId] ?? 0;
}

// ---------------------------------------------------------------------------
// Server-side query config (used by the API route for per-category fetching)
// ---------------------------------------------------------------------------

export type InterestQueryConfig =
  | { type: "category"; categoryId: string }
  | { type: "or_filter"; filter: string }
  | null;

/**
 * Return the PostgREST filter config for fetching events matching a chip.
 * Category chips → simple `category_id = X` filter.
 * Genre/tag chips → OR filter across genres/tags arrays.
 * Specials/unsupported → null (skip server-side query).
 */
export function getInterestQueryConfig(chipId: string): InterestQueryConfig {
  const chip = INTEREST_MAP.get(chipId);
  if (!chip) return null;

  const keys = CHIP_COUNT_KEYS[chipId];
  if (keys) {
    // Genre/tag-based chip — build PostgREST .or() filter
    const genres = keys.filter((k) => k.startsWith("genre:")).map((k) => k.slice(6));
    const tags = keys.filter((k) => k.startsWith("tag:")).map((k) => k.slice(4));
    const parts: string[] = [];
    if (genres.length) parts.push(`genres.ov.{${genres.join(",")}}`);
    if (tags.length) parts.push(`tags.ov.{${tags.join(",")}}`);
    if (chipId === "free") parts.push("is_free.eq.true");
    return parts.length ? { type: "or_filter", filter: parts.join(",") } : null;
  }

  // Category-based chip — chip ID is the category_id column value
  return { type: "category", categoryId: chipId };
}

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
