import { supabase } from "./supabase";
import type { Event } from "./supabase";
import { getLocalDateString } from "@/lib/formats";
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
  nonprofit_hq: { label: "Nonprofit HQ", icon: "🤝" },  // For organizations headquarters
  venue: { label: "Venue", icon: "📍" },
  festival: { label: "Festival", icon: "🎪" },

  // Recreation
  games: { label: "Games", icon: "🎯" },
  arcade: { label: "Arcade", icon: "🕹️" },
  karaoke: { label: "Karaoke", icon: "🎤" },
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

// Venue types that are event venues (host events)
export const EVENT_VENUE_TYPES = [
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

// Venue types that are places/amenities (food, drinks, entertainment)
export const PLACE_VENUE_TYPES = [
  "bar",
  "restaurant",
  "coffee_shop",
  "brewery",
  "distillery",
  "winery",
  "rooftop",
  "sports_bar",
  "games",
  "arcade",
  "karaoke",
  "bookstore",
  "library",
  "farmers_market",
  "coworking",
  "hotel",
  "lgbtq",
  "food_hall",
  "eatertainment",
] as const;

// Category groupings for "In the area" section on event detail page
export const DESTINATION_CATEGORIES = {
  food: ["restaurant", "food_hall", "cooking_school"],
  drinks: ["bar", "brewery", "distillery", "winery", "rooftop", "sports_bar"],
  nightlife: ["club"],
  caffeine: ["coffee_shop"],
  fun: ["games", "eatertainment", "arcade", "karaoke"],
} as const;

export type DestinationCategory = keyof typeof DESTINATION_CATEGORIES;

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

/**
 * @deprecated Import NEIGHBORHOOD_NAMES from @/config/neighborhoods instead
 * Kept for backwards compatibility - this is now derived from the canonical config.
 */
export const NEIGHBORHOODS = NEIGHBORHOOD_NAMES;

export type Neighborhood = string;

export type VenueType = keyof typeof VENUE_TYPES_MAP;

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
  venue_types: string[] | null;
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
    query = query.or(`venue_type.eq.${type},venue_types.cs.{${type}}`);
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
  const today = getLocalDateString();

  // Get all venues
  let venueQuery = supabase.from("venues").select("*").order("name");

  // Support multiple types separated by comma
  if (type && type !== "all") {
    const types = type.split(",").filter(Boolean);
    if (types.length === 1) {
      venueQuery = venueQuery.or(`venue_type.eq.${types[0]},venue_types.cs.{${types[0]}}`);
    } else if (types.length > 1) {
      // Build OR query for multiple types
      const typeConditions = types.map(t => `venue_type.eq.${t}`).join(",");
      venueQuery = venueQuery.or(typeConditions);
    }
  } else if (category === "venues") {
    // Filter to event venues only
    venueQuery = venueQuery.in("venue_type", [...EVENT_VENUE_TYPES]);
  } else if (category === "places") {
    // Filter to places/amenities only
    venueQuery = venueQuery.in("venue_type", [...PLACE_VENUE_TYPES]);
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
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching spot:", error);
    return null;
  }

  return data as Spot;
}

export async function getUpcomingEventsForSpot(
  venueId: number,
  limit = 10
): Promise<Event[]> {
  const today = getLocalDateString();

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

// Check if a spot is currently open based on hours data
export type HoursData = Record<string, { open: string; close: string } | null>;

// Inferred closing times by venue type when hours data is missing
export const INFERRED_CLOSING_TIMES: Record<string, string> = {
  // Bars and nightlife - late night
  bar: "02:00",
  club: "03:00",
  sports_bar: "02:00",
  rooftop: "00:00",
  lgbtq: "02:00",
  karaoke: "02:00",
  // Breweries and distilleries - medium late
  brewery: "22:00",
  distillery: "22:00",
  winery: "21:00",
  // Restaurants - varies
  restaurant: "22:00",
  food_hall: "21:00",
  // Coffee - early close
  coffee_shop: "18:00",
  // Entertainment
  games: "23:00",
  arcade: "23:00",
  eatertainment: "23:00",
  // Music venues - late
  music_venue: "02:00",
  comedy_club: "00:00",
  theater: "23:00",
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
  return minutes === 0 ? `${displayHours}${period}` : `${displayHours}:${minutes.toString().padStart(2, "0")}${period}`;
}

// Get open status with optional inferred closing time
export type OpenStatus = {
  isOpen: boolean;
  closesAt: string | null;
  closingTimeInferred: boolean;
  is24Hours: boolean;
};

export function getSpotOpenStatus(
  hours: HoursData | null,
  is24Hours: boolean,
  venueType: string | null
): OpenStatus {
  if (is24Hours) {
    return { isOpen: true, closesAt: null, closingTimeInferred: false, is24Hours: true };
  }

  const { isOpen, closesAt } = isSpotOpen(hours, false);

  if (closesAt) {
    return {
      isOpen,
      closesAt: formatClosingTime(closesAt),
      closingTimeInferred: false,
      is24Hours: false,
    };
  }

  // If no hours data, try to infer closing time
  if (!hours || !isOpen) {
    const inferredClose = getInferredClosingTime(venueType);
    if (inferredClose) {
      return {
        isOpen: true, // Assume open if no hours data
        closesAt: formatClosingTime(inferredClose),
        closingTimeInferred: true,
        is24Hours: false,
      };
    }
  }

  return { isOpen, closesAt: null, closingTimeInferred: false, is24Hours: false };
}

export function isSpotOpen(hours: HoursData | null, is24Hours?: boolean): { isOpen: boolean; closesAt?: string } {
  if (is24Hours) return { isOpen: true };
  if (!hours) return { isOpen: true }; // Assume open if no hours data

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
    // Filter by venue types
    const typeFilters = spotTypes.map(t => `venue_type.eq.${t},venue_types.cs.{${t}}`).join(",");
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
    .maybeSingle<{ neighborhood: string | null }>();

  if (!venue?.neighborhood) return [];

  // Get nearby spots in same neighborhood (excluding the event venue)
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("neighborhood", venue.neighborhood)
    .neq("id", venueId)
    .in("venue_type", ["bar", "restaurant", "coffee_shop", "brewery"])
    .eq("active", true)
    .limit(limit);

  if (error) {
    console.error("Error fetching nearby spots:", error);
    return [];
  }

  return (data || []) as Spot[];
}

// ============================================
// BACKWARDS COMPATIBILITY EXPORTS
// ============================================
// These aliases allow old code to continue working after the rename

/** @deprecated Use VENUE_TYPES_MAP instead */
export const SPOT_TYPES = VENUE_TYPES_MAP;

/** @deprecated Use VenueType instead */
export type SpotType = VenueType;

/** @deprecated Use getVenueTypeLabel instead */
export const getSpotTypeLabel = getVenueTypeLabel;

/** @deprecated Use getVenueTypeLabels instead */
export const getSpotTypeLabels = getVenueTypeLabels;
