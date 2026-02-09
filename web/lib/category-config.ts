// Category configuration - shared between server and client components
// This file intentionally has no "use client" directive so it can be imported from server components.

export const CATEGORY_CONFIG = {
  // Event categories
  music: { label: "Music", color: "#F9A8D4" },
  film: { label: "Film", color: "#A5B4FC" },
  comedy: { label: "Comedy", color: "#FCD34D" },
  theater: { label: "Theater", color: "#F0ABFC" },
  art: { label: "Art", color: "#C4B5FD" },
  community: { label: "Community", color: "#6EE7B7" },
  food_drink: { label: "Food & Drink", color: "#FDBA74" },
  sports: { label: "Sports", color: "#7DD3FC" },
  fitness: { label: "Fitness", color: "#5EEAD4" },
  nightlife: { label: "Nightlife", color: "#E879F9" },
  family: { label: "Family", color: "#A78BFA" },
  learning: { label: "Learning", color: "#A8E6CF" },
  dance: { label: "Dance", color: "#F9A8D4" },
  tours: { label: "Tours", color: "#7DD3FC" },
  meetup: { label: "Meetup", color: "#ED1C40" },
  words: { label: "Words", color: "#93C5FD" },
  religious: { label: "Religious", color: "#DDD6FE" },
  markets: { label: "Markets", color: "#FCA5A5" },
  wellness: { label: "Wellness", color: "#99F6E4" },
  gaming: { label: "Gaming", color: "#86EFAC" },
  outdoors: { label: "Outdoors", color: "#BEF264" },
  activism: { label: "Activism", color: "#F87171" },
  other: { label: "Other", color: "#8B8B94" },

  // Spot types
  music_venue: { label: "Music Venue", color: "#F9A8D4" },
  bar: { label: "Bar", color: "#FDBA74" },
  restaurant: { label: "Restaurant", color: "#FB923C" },
  coffee_shop: { label: "Coffee", color: "#D4A574" },
  brewery: { label: "Brewery", color: "#FCD34D" },
  gallery: { label: "Gallery", color: "#C4B5FD" },
  club: { label: "Club", color: "#E879F9" },
  arena: { label: "Arena", color: "#7DD3FC" },
  comedy_club: { label: "Comedy Club", color: "#FCD34D" },
  museum: { label: "Museum", color: "#94A3B8" },
  convention_center: { label: "Convention", color: "#38BDF8" },
  games: { label: "Games", color: "#4ADE80" },
  bookstore: { label: "Bookstore", color: "#93C5FD" },
  library: { label: "Library", color: "#60A5FA" },
  venue: { label: "Venue", color: "#A78BFA" },
  organization: { label: "Organization", color: "#6EE7B7" },
  festival: { label: "Festival", color: "#FBBF24" },
  cinema: { label: "Cinema", color: "#A5B4FC" },
  park: { label: "Park", color: "#86EFAC" },
  garden: { label: "Garden", color: "#4ADE80" },
  outdoor: { label: "Outdoor", color: "#BEF264" },
  food_hall: { label: "Food Hall", color: "#FB923C" },
  farmers_market: { label: "Farmers Market", color: "#FCA5A5" },

  // Extended categories
  haunted: { label: "Haunted", color: "#9333EA" },
  cooking: { label: "Cooking", color: "#F97316" },
  eatertainment: { label: "Eatertainment", color: "#22D3EE" },
  yoga: { label: "Yoga", color: "#A3E635" },
  coworking: { label: "Coworking", color: "#60A5FA" },
  record_store: { label: "Record Store", color: "#EC4899" },
  lgbtq: { label: "LGBTQ+", color: "#F472B6" },
  sports_bar: { label: "Sports Bar", color: "#38BDF8" },
  sports_venue: { label: "Sports Venue", color: "#4ADE80" },
  attraction: { label: "Attraction", color: "#FBBF24" },
  studio: { label: "Studio", color: "#A3E635" },
  nightclub: { label: "Nightclub", color: "#E879F9" },
  cooking_school: { label: "Cooking School", color: "#F97316" },
  community_center: { label: "Community Center", color: "#6EE7B7" },

  // Extended spot types
  college: { label: "College", color: "#60A5FA" },
  university: { label: "University", color: "#60A5FA" },
  healthcare: { label: "Healthcare", color: "#34D399" },
  hospital: { label: "Hospital", color: "#34D399" },
  hotel: { label: "Hotel", color: "#FBBF24" },
  rooftop: { label: "Rooftop", color: "#F472B6" },
  distillery: { label: "Distillery", color: "#D97706" },
  winery: { label: "Winery", color: "#A855F7" },
  church: { label: "Church", color: "#DDD6FE" },
  event_space: { label: "Event Space", color: "#A78BFA" },
  fitness_center: { label: "Fitness Center", color: "#5EEAD4" },
} as const;

export type CategoryType = keyof typeof CATEGORY_CONFIG;

export function getCategoryColor(type: string): string {
  return CATEGORY_CONFIG[type as CategoryType]?.color || "#8B8B94";
}

export function getCategoryLabel(type: string): string {
  return CATEGORY_CONFIG[type as CategoryType]?.label || type;
}

// ─── Map Pin Color Families ───────────────────────────────────────────────────
// 7 high-contrast colors optimized for dark map backgrounds.
// Used ONLY for map pins — cards/badges keep using getCategoryColor().

const MAP_PIN_FAMILY_LOOKUP: Record<string, string> = {
  // Rose #FB7185 — music, dance, nightlife (brighter, pops on dark)
  music: "#FB7185", dance: "#FB7185", nightlife: "#FB7185", nightclub: "#FB7185",
  lgbtq: "#FB7185", music_venue: "#FB7185", club: "#FB7185", record_store: "#FB7185",

  // Vivid Orange #FF9C52 — food & drink (warmer, more saturated)
  food_drink: "#FF9C52", bar: "#FF9C52", restaurant: "#FF9C52", brewery: "#FF9C52",
  cooking: "#FF9C52", cooking_school: "#FF9C52", coffee_shop: "#FF9C52",
  distillery: "#FF9C52", winery: "#FF9C52", food_hall: "#FF9C52",
  farmers_market: "#FF9C52", sports_bar: "#FF9C52",

  // Amber #FCD34D — entertainment & attractions (brighter gold)
  comedy: "#FCD34D", comedy_club: "#FCD34D", festival: "#FCD34D", markets: "#FCD34D",
  attraction: "#FCD34D", hotel: "#FCD34D", eatertainment: "#FCD34D",

  // Mint #34D399 — community & wellness (brighter, more visible)
  community: "#34D399", fitness: "#34D399", fitness_center: "#34D399",
  wellness: "#34D399", outdoors: "#34D399", outdoor: "#34D399", park: "#34D399",
  garden: "#34D399", yoga: "#34D399", community_center: "#34D399",

  // Cyan #22D3EE — sports & screen (more saturated, distinct from violet)
  sports: "#22D3EE", sports_venue: "#22D3EE", film: "#22D3EE", cinema: "#22D3EE",
  tours: "#22D3EE", arena: "#22D3EE", convention_center: "#22D3EE",

  // Bright Violet #A78BFA — arts & learning (brighter, more visible)
  art: "#A78BFA", theater: "#A78BFA", gallery: "#A78BFA", museum: "#A78BFA",
  learning: "#A78BFA", words: "#A78BFA", religious: "#A78BFA", church: "#A78BFA",
  library: "#A78BFA", bookstore: "#A78BFA", college: "#A78BFA",
  university: "#A78BFA", studio: "#A78BFA",

  // Coral #F87171 — everything else
  family: "#F87171", meetup: "#F87171", activism: "#F87171", gaming: "#F87171",
  games: "#F87171", haunted: "#F87171", rooftop: "#F87171", coworking: "#F87171",
  venue: "#F87171", organization: "#F87171", event_space: "#F87171",
  healthcare: "#F87171", hospital: "#F87171", other: "#F87171",
};

const MAP_PIN_DEFAULT = "#F87171";

/** High-contrast pin color for map display (7 families). */
export function getMapPinColor(type: string): string {
  return MAP_PIN_FAMILY_LOOKUP[type] || MAP_PIN_DEFAULT;
}

/** All 7 unique map pin family hex values. Useful for Mapbox match expressions. */
export const MAP_PIN_COLORS = [
  "#FB7185", "#FF9C52", "#FCD34D", "#34D399", "#22D3EE", "#A78BFA", "#F87171",
] as const;
