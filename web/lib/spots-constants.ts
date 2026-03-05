import { NEIGHBORHOOD_NAMES } from "@/config/neighborhoods";

export const VENUE_TYPES_MAP = {
  // Entertainment venues
  music_venue: { label: "Music Venue", icon: "🎵" },
  theater: { label: "Theater", icon: "🎭" },
  comedy_club: { label: "Comedy Club", icon: "🎤" },
  club: { label: "Club", icon: "🪩" },
  arena: { label: "Arena", icon: "🏟️" },
  cinema: { label: "Cinema", icon: "🎬" },
  attraction: { label: "Attraction", icon: "🎢" },
  amphitheater: { label: "Amphitheater", icon: "🎭" },
  stadium: { label: "Stadium", icon: "🏟️" },
  nightclub: { label: "Nightclub", icon: "🪩" },

  // Food & Drink
  bar: { label: "Bar", icon: "🍺" },
  restaurant: { label: "Restaurant", icon: "🍽️" },
  coffee_shop: { label: "Coffee", icon: "☕" },
  brewery: { label: "Brewery", icon: "🍻" },
  distillery: { label: "Distillery", icon: "🥃" },
  winery: { label: "Winery", icon: "🍷" },
  wine_bar: { label: "Wine Bar", icon: "🍷" },
  cocktail_bar: { label: "Cocktail Bar", icon: "🍸" },
  lounge: { label: "Lounge", icon: "🛋️" },
  rooftop: { label: "Rooftop", icon: "🌃" },
  sports_bar: { label: "Sports Bar", icon: "📺" },
  food_hall: { label: "Food Hall", icon: "🍴" },
  eatertainment: { label: "Eatertainment", icon: "🎳" },

  // Cultural
  gallery: { label: "Gallery", icon: "🖼️" },
  museum: { label: "Museum", icon: "🏛️" },
  studio: { label: "Studio", icon: "🎬" },
  record_store: { label: "Record Store", icon: "🎵" },

  // Education
  college: { label: "College", icon: "🎓" },
  university: { label: "University", icon: "🎓" },
  library: { label: "Library", icon: "📚" },
  bookstore: { label: "Bookstore", icon: "📖" },
  cooking_school: { label: "Cooking School", icon: "👨‍🍳" },
  dance_studio: { label: "Dance Studio", icon: "💃" },

  // Community & Events
  convention_center: { label: "Convention", icon: "🏢" },
  community_center: { label: "Community Center", icon: "🏘️" },
  event_space: { label: "Event Space", icon: "✨" },
  coworking: { label: "Coworking", icon: "💻" },
  nonprofit_hq: { label: "Nonprofit HQ", icon: "🤝" },
  venue: { label: "Venue", icon: "📍" },
  festival: { label: "Festival", icon: "🎪" },

  // Recreation
  escape_room: { label: "Escape Room", icon: "🔐" },
  games: { label: "Games", icon: "🎯" },
  arcade: { label: "Arcade", icon: "🕹️" },
  karaoke: { label: "Karaoke", icon: "🎤" },
  park: { label: "Park", icon: "🌳" },
  garden: { label: "Garden", icon: "🌷" },
  outdoor_venue: { label: "Outdoor", icon: "⛰️" },
  farmers_market: { label: "Farmers Market", icon: "🥬" },
  market: { label: "Market", icon: "🛍️" },
  fitness_center: { label: "Fitness Center", icon: "💪" },
  bowling: { label: "Bowling", icon: "🎳" },
  pool_hall: { label: "Pool Hall", icon: "🎱" },
  recreation: { label: "Recreation", icon: "🏃" },
  plaza: { label: "Plaza", icon: "🏛️" },
  zoo: { label: "Zoo", icon: "🦁" },
  aquarium: { label: "Aquarium", icon: "🐠" },

  // Landmarks & Sightseeing
  landmark: { label: "Landmark", icon: "🏛️" },
  skyscraper: { label: "Skyscraper", icon: "🏙️" },
  artifact: { label: "Artifact", icon: "🏺" },
  public_art: { label: "Public Art", icon: "🎨" },
  viewpoint: { label: "Viewpoint", icon: "👁️" },
  trail: { label: "Trail", icon: "🥾" },
  historic_site: { label: "Historic Site", icon: "📜" },

  // Healthcare
  healthcare: { label: "Healthcare", icon: "🏥" },
  hospital: { label: "Hospital", icon: "🏥" },

  // Hospitality
  hotel: { label: "Hotel", icon: "🏨" },

  // Religious
  church: { label: "Church", icon: "⛪" },

  // LGBTQ+
  lgbtq: { label: "LGBTQ+", icon: "🏳️‍🌈" },

  // Post-consolidation types (from migration 20260129000002)
  arts_center: { label: "Arts Center", icon: "🎨" },
  institution: { label: "Institution", icon: "🏛️" },
  retail: { label: "Retail", icon: "🛍️" },
  fitness: { label: "Fitness", icon: "💪" },
  // recreation already defined above in Recreation section
} as const;

export type VenueType = keyof typeof VENUE_TYPES_MAP;

// Backwards compatibility aliases
export const SPOT_TYPES = VENUE_TYPES_MAP;
export type SpotType = VenueType;

// Venue types that are event venues (host events)
// Aligned with post-consolidation DB types (migration 20260129000002)
export const EVENT_VENUE_TYPES = [
  "music_venue",
  "theater",
  "nightclub",
  "cinema",
  "stadium",
  "amphitheater",
  "museum",
  "gallery",
  "arts_center",
  "event_space",
  "community_center",
  "park",
  "institution",
  "fitness",
  "attraction",
  "festival",
  "recreation",
] as const;

// Venue types that are places/amenities (food, drinks, sightseeing)
// Aligned with post-consolidation DB types (migration 20260129000002)
export const PLACE_VENUE_TYPES = [
  "bar",
  "restaurant",
  "brewery",
  "cocktail_bar",
  "rooftop",
  "eatertainment",
  "bookstore",
  "library",
  "farmers_market",
  "market",
  "coworking",
  "hotel",
  "retail",
  "lgbtq",
  "landmark",
  "skyscraper",
  "artifact",
  "public_art",
  "viewpoint",
  "trail",
] as const;

// Category groupings for "In the area" section on event detail page
// Aligned with post-consolidation DB types
export const DESTINATION_CATEGORIES = {
  food: ["restaurant"],
  drinks: ["bar", "brewery", "cocktail_bar", "rooftop"],
  nightlife: ["nightclub"],
  fun: ["recreation", "eatertainment", "arcade", "karaoke"],
} as const;

export type DestinationCategory = keyof typeof DESTINATION_CATEGORIES;

/**
 * Alias map: post-consolidation type → legacy DB types that should also match.
 * Applied at query time so QUICK_VENUE_TYPES / SPOTS_TABS stay clean.
 */
export const VENUE_TYPE_ALIASES: Record<string, string[]> = {
  restaurant: ["coffee_shop", "cafe", "food_hall", "cooking_school"],
  bar: ["sports_bar", "lounge", "wine_bar", "club"],
  fitness: ["fitness_center"],
  nightclub: ["club"],
  theater: ["performing_arts"],
  arts_center: ["cultural_center"],
  convention_center: ["convention"],
  recreation: ["entertainment"],
};

/** Top cuisine types by count + Atlanta relevance — UI filter options */
export const CUISINE_TYPES = [
  { value: "southern", label: "Southern" },
  { value: "soul_food", label: "Soul Food" },
  { value: "bbq", label: "BBQ" },
  { value: "mexican", label: "Mexican" },
  { value: "italian", label: "Italian" },
  { value: "japanese", label: "Japanese" },
  { value: "seafood", label: "Seafood" },
  { value: "pizza", label: "Pizza" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "thai", label: "Thai" },
  { value: "korean", label: "Korean" },
  { value: "indian", label: "Indian" },
] as const;

// ─── Spot Discovery UI Config ─────────────────────────────────────────────────
// Used by PortalSpotsView and other spots listing UIs.

/** Venue type display config — only types that exist in the DB post-consolidation.
 *  For label lookups on legacy/stale types, use VENUE_TYPES_MAP instead. */
export const SPOT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  // Performance & Arts
  music_venue: { label: "Music Venues", color: "#F472B6" },
  theater: { label: "Theaters", color: "#F87171" },
  cinema: { label: "Cinemas", color: "#A5B4FC" },
  nightclub: { label: "Nightclubs", color: "#E879F9" },
  amphitheater: { label: "Amphitheaters", color: "#F87171" },
  // Food & Drink (coffee_shop, food_hall merged into restaurant; sports_bar, lounge, wine_bar merged into bar)
  restaurant: { label: "Restaurants", color: "#FB923C" },
  bar: { label: "Bars", color: "#C084FC" },
  brewery: { label: "Breweries", color: "#FBBF24" },
  cocktail_bar: { label: "Cocktail Bars", color: "#E879F9" },
  rooftop: { label: "Rooftops", color: "#38BDF8" },
  // Cultural
  gallery: { label: "Galleries", color: "#C4B5FD" },
  museum: { label: "Museums", color: "#A78BFA" },
  arts_center: { label: "Arts Centers", color: "#C084FC" },
  bookstore: { label: "Bookstores", color: "#93C5FD" },
  library: { label: "Libraries", color: "#60A5FA" },
  // Community & Education
  community_center: { label: "Community Centers", color: "#6EE7B7" },
  institution: { label: "Institutions", color: "#60A5FA" },
  coworking: { label: "Coworking", color: "#60A5FA" },
  // Sports & Outdoors
  stadium: { label: "Stadiums", color: "#7DD3FC" },
  fitness: { label: "Fitness", color: "#5EEAD4" },
  park: { label: "Parks", color: "#86EFAC" },
  recreation: { label: "Recreation", color: "#86EFAC" },
  // Events & Entertainment
  event_space: { label: "Event Spaces", color: "#A78BFA" },
  eatertainment: { label: "Eatertainment", color: "#22D3EE" },
  attraction: { label: "Attractions", color: "#FBBF24" },
  // Sightseeing
  landmark: { label: "Landmarks", color: "#A78BFA" },
  skyscraper: { label: "Skyscrapers", color: "#D4AF37" },
  artifact: { label: "Artifacts", color: "#CD7F32" },
  public_art: { label: "Public Art", color: "#C084FC" },
  viewpoint: { label: "Viewpoints", color: "#38BDF8" },
  trail: { label: "Trails", color: "#86EFAC" },
  // Retail & Services
  farmers_market: { label: "Markets", color: "#FCA5A5" },
  market: { label: "Markets", color: "#86EFAC" },
  retail: { label: "Retail", color: "#FB923C" },
  hotel: { label: "Hotels", color: "#FBBF24" },
  lgbtq: { label: "LGBTQ+", color: "#E879F9" },
  // Catch-all
  other: { label: "Other", color: "#64748B" },
};

/** Category grouping order for sorted spot lists — post-consolidation types only */
export const SPOT_TYPE_ORDER = [
  "music_venue", "theater", "cinema", "nightclub", "amphitheater",
  "restaurant", "bar", "brewery", "cocktail_bar", "rooftop",
  "gallery", "museum", "arts_center", "bookstore", "library",
  "community_center", "institution", "coworking",
  "stadium", "fitness", "park", "recreation",
  "landmark", "skyscraper", "artifact", "public_art", "viewpoint", "trail",
  "event_space", "eatertainment", "attraction",
  "farmers_market", "market", "retail", "hotel", "lgbtq", "other",
] as const;

/** Quick-filter venue type groups for filter UI — post-consolidation types only */
export const QUICK_VENUE_TYPES = [
  { key: "nightlife", label: "Nightlife", types: ["bar", "nightclub", "brewery", "cocktail_bar", "rooftop"], color: "#C084FC" },
  { key: "food", label: "Food", types: ["restaurant", "farmers_market", "market"], color: "#FB923C" },
  { key: "music", label: "Music", types: ["music_venue", "amphitheater"], color: "#F472B6" },
  { key: "arts", label: "Arts", types: ["theater", "gallery", "museum", "arts_center"], color: "#A78BFA" },
  { key: "fun", label: "Fun", types: ["recreation", "eatertainment", "attraction"], color: "#86EFAC" },
  { key: "outdoors", label: "Outdoors", types: ["park", "trail", "viewpoint", "garden", "outdoor_venue"], color: "#4ADE80" },
  { key: "landmarks", label: "Landmarks", types: ["landmark", "historic_site", "skyscraper", "artifact", "public_art"], color: "#A78BFA" },
] as const;

/** Unified category presets for both list and map filter UIs */
export const VENUE_CATEGORY_PRESETS = QUICK_VENUE_TYPES;

// ─── Spots Sub-Tab Config ──────────────────────────────────────────────────

export type SpotsTab = "eat-drink" | "things-to-do" | "nightlife";

/** Typed chip filter overrides. venueTypes REPLACES the tab default; vibes/cuisine MERGE. */
export type ChipFilterOverrides = {
  venueTypes?: readonly string[];
  vibes?: readonly string[];
  cuisine?: readonly string[];
};

export type ChipDefinition = {
  readonly key: string;
  readonly label: string;
  readonly icon?: string;
  readonly filterOverrides: ChipFilterOverrides;
  readonly color: string;
};

export interface SpotsTabConfig {
  key: SpotsTab;
  label: string;
  icon: string;
  venueTypes: string[];
  chips: readonly ChipDefinition[];
}

/** Occasion chips for Eat & Drink tab — compound filter presets */
const OCCASION_CHIPS: readonly ChipDefinition[] = [
  { key: "coffee", label: "Coffee", icon: "coffee_shop", filterOverrides: { venueTypes: ["restaurant"], cuisine: ["coffee"] }, color: "#D4A574" },
  { key: "breakfast", label: "Breakfast", icon: "restaurant", filterOverrides: { cuisine: ["brunch_breakfast", "coffee"] }, color: "#FB923C" },
  { key: "brunch", label: "Brunch", icon: "food_drink", filterOverrides: { cuisine: ["brunch_breakfast"] }, color: "#FBBF24" },
  { key: "lunch", label: "Lunch", icon: "restaurant", filterOverrides: { venueTypes: ["restaurant", "food_hall"] }, color: "#FB923C" },
  { key: "happy-hour", label: "Happy Hour", icon: "bar", filterOverrides: { venueTypes: ["bar", "brewery", "restaurant"] }, color: "#FBBF24" },
  { key: "late-night", label: "Late Night", icon: "nightlife", filterOverrides: { vibes: ["late-night"] }, color: "#A78BFA" },
  { key: "date-night-ed", label: "Date Night", icon: "food_drink", filterOverrides: { vibes: ["date-spot", "upscale", "intimate"] }, color: "#F472B6" },
];

/** Visual category tile definitions for Things to Do browse grid */
export type ThingsToDoTile = {
  readonly key: string;
  readonly label: string;
  readonly venueTypes: readonly string[];
  readonly color: string;
  readonly iconType: string; // Maps to CategoryIcon type prop
};

export const THINGS_TO_DO_TILES: readonly ThingsToDoTile[] = [
  { key: "museums", label: "Museums", venueTypes: ["museum", "arts_center"], color: "#A78BFA", iconType: "museum" },
  { key: "galleries", label: "Galleries", venueTypes: ["gallery"], color: "#C084FC", iconType: "gallery" },
  { key: "parks", label: "Parks & Gardens", venueTypes: ["park", "garden"], color: "#86EFAC", iconType: "park" },
  { key: "trails", label: "Trails & Nature", venueTypes: ["trail", "viewpoint"], color: "#4ADE80", iconType: "trail" },
  { key: "arts", label: "Arts & Theater", venueTypes: ["theater", "cinema", "amphitheater"], color: "#F472B6", iconType: "theater" },
  { key: "entertainment-games", label: "Entertainment & Games", venueTypes: ["arcade", "recreation", "attraction", "eatertainment", "entertainment", "bowling", "pool_hall"], color: "#22D3EE", iconType: "gaming" },
  { key: "escape-rooms", label: "Escape Rooms", venueTypes: ["escape_room"], color: "#E879F9", iconType: "lock" },
  { key: "historic", label: "Historic Sites", venueTypes: ["landmark", "historic_site", "skyscraper", "artifact", "public_art"], color: "#FBBF24", iconType: "landmark" },
  { key: "fitness", label: "Fitness & Wellness", venueTypes: ["fitness", "fitness_center", "stadium"], color: "#5EEAD4", iconType: "fitness" },
  { key: "zoos", label: "Zoos & Aquariums", venueTypes: ["zoo", "aquarium"], color: "#FB923C", iconType: "outdoors" },
  { key: "markets", label: "Markets & Food Halls", venueTypes: ["farmers_market", "food_hall"], color: "#FCA5A5", iconType: "farmers_market" },
  { key: "libraries", label: "Libraries & Learning", venueTypes: ["bookstore", "library", "institution", "community_center"], color: "#60A5FA", iconType: "library" },
] as const;

/** Category chips for Things to Do tab — aligned with tile keys */
const ACTIVITY_CHIPS: readonly ChipDefinition[] = [
  { key: "museums", label: "Museums", icon: "museum", filterOverrides: { venueTypes: ["museum", "arts_center"] }, color: "#A78BFA" },
  { key: "galleries", label: "Galleries", icon: "gallery", filterOverrides: { venueTypes: ["gallery"] }, color: "#C084FC" },
  { key: "parks", label: "Parks", icon: "park", filterOverrides: { venueTypes: ["park", "garden"] }, color: "#86EFAC" },
  { key: "trails", label: "Trails", icon: "trail", filterOverrides: { venueTypes: ["trail", "viewpoint"] }, color: "#4ADE80" },
  { key: "arts", label: "Arts & Theater", icon: "theater", filterOverrides: { venueTypes: ["theater", "cinema", "amphitheater"] }, color: "#F472B6" },
  { key: "entertainment-games", label: "Entertainment", icon: "games", filterOverrides: { venueTypes: ["arcade", "recreation", "attraction", "eatertainment", "entertainment", "bowling", "pool_hall"] }, color: "#22D3EE" },
  { key: "escape-rooms", label: "Escape Rooms", icon: "lock", filterOverrides: { venueTypes: ["escape_room"] }, color: "#E879F9" },
  { key: "historic", label: "Historic Sites", icon: "landmark", filterOverrides: { venueTypes: ["landmark", "historic_site", "skyscraper", "artifact", "public_art"] }, color: "#FBBF24" },
  { key: "fitness", label: "Fitness", icon: "fitness", filterOverrides: { venueTypes: ["fitness", "fitness_center", "stadium"] }, color: "#5EEAD4" },
];

/** Vibe chips for Nightlife tab */
const NIGHTLIFE_CHIPS: readonly ChipDefinition[] = [
  { key: "live-music", label: "Live Music", icon: "music", filterOverrides: { vibes: ["live-music"] }, color: "#F472B6" },
  { key: "cocktails", label: "Cocktails", icon: "food_drink", filterOverrides: { vibes: ["craft-cocktails"] }, color: "#FBBF24" },
  { key: "date-night-nl", label: "Date Night", icon: "food_drink", filterOverrides: { vibes: ["date-spot", "intimate"] }, color: "#F472B6" },
  { key: "divey", label: "Divey", icon: "bar", filterOverrides: { vibes: ["dive-bar", "casual"] }, color: "#86EFAC" },
];

export const SPOTS_TABS: SpotsTabConfig[] = [
  {
    key: "eat-drink",
    label: "Eat & Drink",
    icon: "fork-knife",
    venueTypes: [
      "restaurant", "bar", "brewery", "cocktail_bar", "wine_bar", "rooftop", "lounge",
      "sports_bar", "food_hall", "eatertainment", "farmers_market", "market",
      "coffee_shop", "cooking_school", "retail",
    ],
    chips: OCCASION_CHIPS,
  },
  {
    key: "things-to-do",
    label: "Things to Do",
    icon: "compass",
    venueTypes: [
      "museum", "gallery", "arts_center", "theater", "cinema", "park", "trail",
      "recreation", "arcade", "attraction", "entertainment", "landmark", "viewpoint", "skyscraper",
      "artifact", "public_art", "fitness", "fitness_center", "bookstore", "library", "stadium",
      "amphitheater", "community_center", "institution", "event_space",
      "convention_center", "festival", "coworking", "studio", "arena",
      "zoo", "aquarium", "bowling", "pool_hall", "historic_site", "escape_room",
    ],
    chips: ACTIVITY_CHIPS,
  },
  {
    key: "nightlife",
    label: "Nightlife",
    icon: "moon",
    venueTypes: [
      "bar", "nightclub", "brewery", "cocktail_bar", "rooftop", "lounge",
      "music_venue", "comedy_club", "karaoke", "lgbtq", "sports_bar", "games",
    ],
    chips: NIGHTLIFE_CHIPS,
  },
];

/** Data-driven tab lookup — derive everything from SPOTS_TABS */
const VALID_TABS = new Set<string>(SPOTS_TABS.map((t) => t.key));
export function isValidSpotsTab(v: string | null): v is SpotsTab {
  return v != null && VALID_TABS.has(v);
}

export function getTabConfig(tab: SpotsTab): SpotsTabConfig {
  return SPOTS_TABS.find((t) => t.key === tab) ?? SPOTS_TABS[0];
}

export function getTabChips(tab: SpotsTab): readonly ChipDefinition[] {
  return getTabConfig(tab).chips;
}

export function getTabVenueTypes(tab: SpotsTab): string[] {
  return getTabConfig(tab).venueTypes;
}

/** Quick-access vibes for filter bar — high-value discovery attributes */
export const QUICK_VIBES = [
  { value: "date-spot", label: "Date Spot", color: "#F472B6" },
  { value: "rooftop", label: "Rooftop", color: "#38BDF8" },
  { value: "late-night", label: "Late Night", color: "#A78BFA" },
  { value: "craft-cocktails", label: "Cocktails", color: "#FBBF24" },
  { value: "upscale", label: "Upscale", color: "#D4AF37" },
  { value: "artsy", label: "Artsy", color: "#C084FC" },
  { value: "good-for-groups", label: "Groups", color: "#22D3EE" },
  { value: "black-owned", label: "Black-Owned", color: "#34D399" },
  { value: "live-music", label: "Live Music", color: "#F472B6" },
  { value: "outdoor-seating", label: "Outdoor", color: "#86EFAC" },
  { value: "dog-friendly", label: "Dog Friendly", color: "#FB923C" },
  { value: "family-friendly", label: "Family", color: "#93C5FD" },
  { value: "all-ages", label: "All Ages", color: "#60A5FA" },
  { value: "dive-bar", label: "Divey", color: "#86EFAC" },
] as const;

// Vibes organized by category for UI grouping
export const VIBE_GROUPS = {
  Atmosphere: [
    { value: "late-night", label: "Late Night" },
    { value: "date-spot", label: "Date Spot" },
    { value: "divey", label: "Divey" },
    { value: "intimate", label: "Intimate" },
    { value: "upscale", label: "Upscale" },
    { value: "casual", label: "Casual" },
    { value: "artsy", label: "Artsy" },
    { value: "historic", label: "Historic" },
  ],
  Amenities: [
    { value: "outdoor-seating", label: "Outdoor" },
    { value: "craft-cocktails", label: "Cocktails" },
    { value: "live-music", label: "Live Music" },
    { value: "good-for-groups", label: "Groups" },
    { value: "rooftop", label: "Rooftop" },
    { value: "patio", label: "Patio" },
    { value: "free-parking", label: "Free Parking" },
  ],
  Accessibility: [
    { value: "all-ages", label: "All Ages" },
    { value: "family-friendly", label: "Family Friendly" },
    { value: "dog-friendly", label: "Dog Friendly" },
    { value: "wheelchair-accessible", label: "Accessible" },
  ],
  Identity: [
    { value: "lgbtq-friendly", label: "LGBTQ+" },
    { value: "black-owned", label: "Black-Owned" },
    { value: "woman-owned", label: "Woman-Owned" },
  ],
} as const;

// Flat array of all vibes for compatibility
export const VIBES = [
  ...VIBE_GROUPS.Atmosphere,
  ...VIBE_GROUPS.Amenities,
  ...VIBE_GROUPS.Accessibility,
  ...VIBE_GROUPS.Identity,
] as const;

export type Vibe = (typeof VIBES)[number]["value"];

/**
 * @deprecated Import NEIGHBORHOOD_NAMES from @/config/neighborhoods instead
 * Kept for backwards compatibility - this is now derived from the canonical config.
 */
export const NEIGHBORHOODS = NEIGHBORHOOD_NAMES;

export type Neighborhood = string;

export type Spot = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  venue_type: string | null;
  location_designator?: "standard" | "private_after_signup" | "virtual" | "recovery_meeting" | null;
  venue_types: string[] | null;
  description: string | null;
  short_description: string | null;
  price_level: number | null;
  website: string | null;
  instagram: string | null;
  hours_display: string | null;
  vibes: string[] | null;
  genres: string[] | null;
  image_url: string | null;
  featured: boolean;
  active: boolean;
  claimed_by: string | null;
  is_verified: boolean | null;
  event_count?: number;
  follower_count?: number;
  recommendation_count?: number;
  upcoming_events?: Array<{
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
  }>;
  // API-computed fields (from /api/spots)
  is_open?: boolean;
  closes_at?: string;
  hours?: Record<string, { open: string; close: string } | null> | null;
  is_24_hours?: boolean | null;
  distance_km?: number | null;
};

export function formatPriceLevel(level: number | null): string {
  if (!level) return "";
  return "$".repeat(level);
}

export function getVenueTypeLabel(type: string | null): string {
  if (!type) return "";
  return VENUE_TYPES_MAP[type as VenueType]?.label || type;
}

export function getVenueTypeLabels(types: string[] | null): string {
  if (!types || types.length === 0) return "";
  return types
    .map((t) => VENUE_TYPES_MAP[t as VenueType]?.label || t)
    .join(" + ");
}

export const getSpotTypeLabel = getVenueTypeLabel;
export const getSpotTypeLabels = getVenueTypeLabels;

// Check if a spot is currently open based on hours data
export type HoursData = Record<string, { open: string; close: string } | null>;

// Inferred closing times by venue type when hours data is missing
export const INFERRED_CLOSING_TIMES: Record<string, string> = {
  // Bars and nightlife - late night
  bar: "02:00",
  nightclub: "03:00",
  rooftop: "00:00",
  cocktail_bar: "02:00",
  lgbtq: "02:00",
  karaoke: "02:00",
  // Breweries - medium late
  brewery: "22:00",
  // Restaurants - varies
  restaurant: "22:00",
  // Entertainment
  recreation: "23:00",
  arcade: "23:00",
  eatertainment: "23:00",
  // Music & performance venues - late
  music_venue: "02:00",
  theater: "23:00",
  amphitheater: "23:00",
};

// Get inferred closing time based on venue type
export function getInferredClosingTime(venueType: string | null): string | null {
  if (!venueType) return null;
  return INFERRED_CLOSING_TIMES[venueType] || null;
}

// Format closing time for display (e.g., "02:00" -> "2am")
export function formatClosingTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return minutes === 0
    ? `${displayHours}${period}`
    : `${displayHours}:${minutes.toString().padStart(2, "0")}${period}`;
}

// Get open status with optional inferred closing time
export type OpenStatus = {
  isOpen: boolean;
  closesAt: string | null;
  closingTimeInferred: boolean;
  is24Hours: boolean;
};

export function isSpotOpen(
  hours: HoursData | null,
  is24Hours?: boolean
): { isOpen: boolean; closesAt?: string } {
  if (is24Hours) return { isOpen: true };
  if (!hours) return { isOpen: false };

  const now = new Date();
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = dayNames[now.getDay()];
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  const todayHours = hours[today];
  if (!todayHours) return { isOpen: false };

  const { open, close } = todayHours;

  // Handle overnight hours (e.g., open 18:00, close 02:00)
  if (close < open) {
    if (currentTime >= open || currentTime < close) {
      return { isOpen: true, closesAt: close };
    }
  } else {
    if (currentTime >= open && currentTime < close) {
      return { isOpen: true, closesAt: close };
    }
  }

  return { isOpen: false };
}
