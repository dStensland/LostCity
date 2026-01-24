import { supabase } from "./supabase";
import type { Event } from "./supabase";

export const SPOT_TYPES = {
  // Entertainment venues
  music_venue: { label: "Music Venue", icon: "🎵" },
  theater: { label: "Theater", icon: "🎭" },
  comedy_club: { label: "Comedy Club", icon: "🎤" },
  club: { label: "Club", icon: "🪩" },
  arena: { label: "Arena", icon: "🏟️" },
  cinema: { label: "Cinema", icon: "🎬" },
  attraction: { label: "Attraction", icon: "🎢" },

  // Food & Drink
  bar: { label: "Bar", icon: "🍺" },
  restaurant: { label: "Restaurant", icon: "🍽️" },
  coffee_shop: { label: "Coffee", icon: "☕" },
  brewery: { label: "Brewery", icon: "🍻" },
  distillery: { label: "Distillery", icon: "🥃" },
  winery: { label: "Winery", icon: "🍷" },
  rooftop: { label: "Rooftop", icon: "🌃" },
  sports_bar: { label: "Sports Bar", icon: "📺" },
  food_hall: { label: "Food Hall", icon: "🍴" },
  eatertainment: { label: "Eatertainment", icon: "🎳" },

  // Cultural
  gallery: { label: "Gallery", icon: "🖼️" },
  museum: { label: "Museum", icon: "🏛️" },
  studio: { label: "Studio", icon: "🎬" },

  // Education
  college: { label: "College", icon: "🎓" },
  university: { label: "University", icon: "🎓" },
  library: { label: "Library", icon: "📚" },
  bookstore: { label: "Bookstore", icon: "📖" },
  cooking_school: { label: "Cooking School", icon: "👨‍🍳" },

  // Community & Events
  convention_center: { label: "Convention", icon: "🏢" },
  community_center: { label: "Community Center", icon: "🏘️" },
  event_space: { label: "Event Space", icon: "✨" },
  coworking: { label: "Coworking", icon: "💻" },
  nonprofit_hq: { label: "Nonprofit HQ", icon: "🤝" },  // For organization headquarters
  venue: { label: "Venue", icon: "📍" },
  festival: { label: "Festival", icon: "🎪" },

  // Recreation
  games: { label: "Games", icon: "🎯" },
  park: { label: "Park", icon: "🌳" },
  garden: { label: "Garden", icon: "🌷" },
  outdoor: { label: "Outdoor", icon: "⛰️" },
  farmers_market: { label: "Farmers Market", icon: "🥬" },
  fitness_center: { label: "Fitness Center", icon: "💪" },

  // Healthcare
  healthcare: { label: "Healthcare", icon: "🏥" },
  hospital: { label: "Hospital", icon: "🏥" },

  // Hospitality
  hotel: { label: "Hotel", icon: "🏨" },

  // Religious
  church: { label: "Church", icon: "⛪" },

  // LGBTQ+
  lgbtq: { label: "LGBTQ+", icon: "🏳️‍🌈" },
} as const;

// Spot types that are event venues (host events)
export const VENUE_TYPES = [
  "music_venue",
  "theater",
  "comedy_club",
  "club",
  "arena",
  "cinema",
  "museum",
  "gallery",
  "convention_center",
  "community_center",
  "event_space",
  "park",
  "garden",
  "outdoor",
  "college",
  "university",
  "church",
  "healthcare",
  "hospital",
  "fitness_center",
  "attraction",
  "festival",
  "venue",
  "studio",
  "cooking_school",
] as const;

// Spot types that are places/amenities (food, drinks, entertainment)
export const PLACE_TYPES = [
  "bar",
  "restaurant",
  "coffee_shop",
  "brewery",
  "distillery",
  "winery",
  "rooftop",
  "sports_bar",
  "games",
  "bookstore",
  "library",
  "farmers_market",
  "coworking",
  "hotel",
  "lgbtq",
  "food_hall",
  "eatertainment",
] as const;

export type SpotCategory = "venues" | "places";

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

export const NEIGHBORHOODS = [
  "Midtown",
  "Downtown",
  "Buckhead",
  "East Atlanta",
  "East Atlanta Village",
  "Inman Park",
  "Virginia-Highland",
  "Decatur",
  "Little Five Points",
  "Old Fourth Ward",
  "West End",
  "Westside",
  "Poncey-Highland",
  "Grant Park",
  "Edgewood",
  "Kirkwood",
  "Druid Hills",
  "Sweet Auburn",
  "Castleberry Hill",
  "Peachtree Hills",
  "Candler Park",
  "Chastain Park",
  "Cascade Heights",
  "Dunwoody",
  "West Midtown",
] as const;

export type Neighborhood = (typeof NEIGHBORHOODS)[number];

export type SpotType = keyof typeof SPOT_TYPES;

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
  spot_type: string | null;
  spot_types: string[] | null;
  description: string | null;
  short_description: string | null;
  price_level: number | null;
  website: string | null;
  instagram: string | null;
  hours_display: string | null;
  vibes: string[] | null;
  image_url: string | null;
  featured: boolean;
  active: boolean;
  event_count?: number;
};

export async function getSpots(type?: string): Promise<Spot[]> {
  let query = supabase
    .from("venues")
    .select("*")
    .order("name");

  if (type && type !== "all") {
    query = query.or(`spot_type.eq.${type},spot_types.cs.{${type}}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching spots:", error);
    return [];
  }

  return (data || []) as Spot[];
}

export async function getSpotsWithEventCounts(
  type?: string,
  vibe?: string,
  neighborhood?: string,
  search?: string,
  category?: SpotCategory
): Promise<Spot[]> {
  const today = new Date().toISOString().split("T")[0];

  // Get all venues
  let venueQuery = supabase.from("venues").select("*").order("name");

  // Support multiple types separated by comma
  if (type && type !== "all") {
    const types = type.split(",").filter(Boolean);
    if (types.length === 1) {
      venueQuery = venueQuery.or(`spot_type.eq.${types[0]},spot_types.cs.{${types[0]}}`);
    } else if (types.length > 1) {
      // Build OR query for multiple types
      const typeConditions = types.map(t => `spot_type.eq.${t}`).join(",");
      venueQuery = venueQuery.or(typeConditions);
    }
  } else if (category === "venues") {
    // Filter to event venues only
    venueQuery = venueQuery.in("spot_type", [...VENUE_TYPES]);
  } else if (category === "places") {
    // Filter to places/amenities only
    venueQuery = venueQuery.in("spot_type", [...PLACE_TYPES]);
  }

  if (vibe) {
    // Support multiple vibes separated by comma
    const vibes = vibe.split(",").filter(Boolean);
    for (const v of vibes) {
      venueQuery = venueQuery.contains("vibes", [v]);
    }
  }

  // Support multiple neighborhoods separated by comma
  if (neighborhood && neighborhood !== "all") {
    const hoods = neighborhood.split(",").filter(Boolean);
    if (hoods.length === 1) {
      venueQuery = venueQuery.eq("neighborhood", hoods[0]);
    } else if (hoods.length > 1) {
      venueQuery = venueQuery.in("neighborhood", hoods);
    }
  }

  // Apply text search filter
  if (search?.trim()) {
    const searchTerm = `%${search.trim()}%`;
    venueQuery = venueQuery.or(
      `name.ilike.${searchTerm},description.ilike.${searchTerm},neighborhood.ilike.${searchTerm}`
    );
  }

  const { data: venues, error: venueError } = await venueQuery;

  if (venueError || !venues) {
    console.error("Error fetching venues:", venueError);
    return [];
  }

  // Get event counts per venue
  const { data: eventCounts, error: countError } = await supabase
    .from("events")
    .select("venue_id")
    .gte("start_date", today);

  if (countError) {
    console.error("Error fetching event counts:", countError);
    return venues as Spot[];
  }

  // Count events per venue
  const countMap = new Map<number, number>();
  for (const event of (eventCounts || []) as { venue_id: number | null }[]) {
    if (event.venue_id) {
      countMap.set(event.venue_id, (countMap.get(event.venue_id) || 0) + 1);
    }
  }

  // Merge counts into venues and sort by event count
  const typedVenues = venues as Spot[];
  const spotsWithCounts = typedVenues.map((venue) => ({
    ...venue,
    event_count: countMap.get(venue.id) || 0,
  }));

  // Sort by event count descending, then by name
  spotsWithCounts.sort((a, b) => {
    if ((b.event_count || 0) !== (a.event_count || 0)) {
      return (b.event_count || 0) - (a.event_count || 0);
    }
    return a.name.localeCompare(b.name);
  });

  return spotsWithCounts;
}

export async function getSpotBySlug(slug: string): Promise<Spot | null> {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Error fetching spot:", error);
    return null;
  }

  return data as Spot;
}

export async function getUpcomingEventsForSpot(
  venueId: number,
  limit = 10
): Promise<Event[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .eq("venue_id", venueId)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching events for spot:", error);
    return [];
  }

  return (data || []) as Event[];
}

export function formatPriceLevel(level: number | null): string {
  if (!level) return "";
  return "$".repeat(level);
}

export function getSpotTypeLabel(type: string | null): string {
  if (!type) return "";
  return SPOT_TYPES[type as SpotType]?.label || type;
}

export function getSpotTypeLabels(types: string[] | null): string {
  if (!types || types.length === 0) return "";
  return types
    .map((t) => SPOT_TYPES[t as SpotType]?.label || t)
    .join(" + ");
}

// Check if a spot is currently open based on hours data
type HoursData = Record<string, { open: string; close: string } | null>;

export function isSpotOpen(hours: HoursData | null, is24Hours?: boolean): { isOpen: boolean; closesAt?: string } {
  if (is24Hours) return { isOpen: true };
  if (!hours) return { isOpen: false };

  const now = new Date();
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = dayNames[now.getDay()];
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const todayHours = hours[today];
  if (!todayHours) return { isOpen: false };

  const { open, close } = todayHours;

  // Handle overnight hours (e.g., open 18:00, close 02:00)
  if (close < open) {
    // Check if we're after opening time today or before closing time (from yesterday)
    if (currentTime >= open || currentTime < close) {
      return { isOpen: true, closesAt: close };
    }
  } else {
    // Normal hours
    if (currentTime >= open && currentTime < close) {
      return { isOpen: true, closesAt: close };
    }
  }

  return { isOpen: false };
}

// Get spots that are currently open
export async function getOpenSpots(
  spotTypes?: string[],
  neighborhood?: string,
  limit = 20
): Promise<Spot[]> {
  let query = supabase
    .from("venues")
    .select("*")
    .eq("active", true)
    .order("name");

  if (spotTypes && spotTypes.length > 0) {
    // Filter by spot types
    const typeFilters = spotTypes.map(t => `spot_type.eq.${t},spot_types.cs.{${t}}`).join(",");
    query = query.or(typeFilters);
  }

  if (neighborhood) {
    query = query.eq("neighborhood", neighborhood);
  }

  query = query.limit(limit * 2); // Fetch extra since we'll filter by open status

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching spots:", error);
    return [];
  }

  // Filter to only open spots
  const openSpots = (data || []).filter((spot: Spot & { hours?: HoursData; is_24_hours?: boolean }) => {
    const { isOpen } = isSpotOpen(spot.hours || null, spot.is_24_hours);
    return isOpen;
  });

  return openSpots.slice(0, limit) as Spot[];
}

export async function getNearbySpots(
  venueId: number,
  limit = 6
): Promise<Spot[]> {
  // Get the venue's neighborhood
  const { data: venue } = await supabase
    .from("venues")
    .select("neighborhood")
    .eq("id", venueId)
    .single<{ neighborhood: string | null }>();

  if (!venue?.neighborhood) return [];

  // Get nearby spots in same neighborhood (excluding the event venue)
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("neighborhood", venue.neighborhood)
    .neq("id", venueId)
    .in("spot_type", ["bar", "restaurant", "coffee_shop", "brewery"])
    .eq("active", true)
    .limit(limit);

  if (error) {
    console.error("Error fetching nearby spots:", error);
    return [];
  }

  return (data || []) as Spot[];
}
