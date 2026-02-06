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
