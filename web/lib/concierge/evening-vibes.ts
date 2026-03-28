/**
 * Evening Vibe Taxonomy
 *
 * Client-safe constants for the Plan My Evening wizard.
 * Maps vibes to event categories, venue types, and time windows.
 */

export type EveningVibe = "chill" | "adventurous" | "date_night" | "group" | "foodie";

export interface VibeConfig {
  id: EveningVibe;
  label: string;
  emoji: string;
  description: string;
  subtitle: string;
  photoUrl: string;
  eventCategories: string[];
  venueTypes: {
    dinner: string[];
    drinks: string[];
    late_night: string[];
  };
}

export const EVENING_VIBES: VibeConfig[] = [
  {
    id: "chill",
    label: "Chill",
    emoji: "\u2728",
    description: "Low-key evening, good food, easy drinks",
    subtitle: "Quiet bars, comfort food, wind-down vibes",
    photoUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80",
    eventCategories: ["music", "food_drink", "film", "art"],
    venueTypes: {
      dinner: ["restaurant", "cafe", "food_hall"],
      drinks: ["wine_bar", "cocktail_bar", "lounge", "taproom"],
      late_night: ["lounge", "wine_bar"],
    },
  },
  {
    id: "adventurous",
    label: "Adventurous",
    emoji: "\uD83D\uDE80",
    description: "Surprise me — hidden gems and new experiences",
    subtitle: "Hidden gems, street art, unexpected discoveries",
    photoUrl: "https://images.unsplash.com/photo-1519214605650-76a613ee3245?w=800&q=80",
    eventCategories: ["music", "comedy", "nightlife", "theater", "art", "food_drink"],
    venueTypes: {
      dinner: ["restaurant", "food_hall", "diner"],
      drinks: ["bar", "brewery", "cocktail_bar", "distillery"],
      late_night: ["bar", "nightclub", "pub", "lounge"],
    },
  },
  {
    id: "date_night",
    label: "Date Night",
    emoji: "\uD83C\uDF39",
    description: "Romantic dinner, cocktails, something special",
    subtitle: "Romantic spots, craft cocktails, unforgettable",
    photoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    eventCategories: ["music", "theater", "comedy", "food_drink", "film", "art"],
    venueTypes: {
      dinner: ["restaurant"],
      drinks: ["cocktail_bar", "rooftop", "wine_bar", "lounge"],
      late_night: ["cocktail_bar", "rooftop", "lounge"],
    },
  },
  {
    id: "group",
    label: "Group Night",
    emoji: "\uD83C\uDF89",
    description: "Fun with friends — energy and options",
    subtitle: "Energy, laughter, everyone's invited",
    photoUrl: "https://images.unsplash.com/photo-1529543544282-ea45407a66b5?w=800&q=80",
    eventCategories: ["music", "comedy", "nightlife", "food_drink", "sports"],
    venueTypes: {
      dinner: ["restaurant", "pizzeria", "food_hall"],
      drinks: ["bar", "brewery", "sports_bar", "pub", "rooftop"],
      late_night: ["bar", "nightclub", "pub", "sports_bar"],
    },
  },
  {
    id: "foodie",
    label: "Foodie",
    emoji: "\uD83C\uDF7D\uFE0F",
    description: "Chef-driven dinner, tasting menus, culinary discovery",
    subtitle: "Chef-driven, farm-to-table, culinary journeys",
    photoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    eventCategories: ["food_drink", "art", "music"],
    venueTypes: {
      dinner: ["restaurant", "food_hall"],
      drinks: ["wine_bar", "cocktail_bar", "distillery"],
      late_night: ["cocktail_bar", "wine_bar"],
    },
  },
];

export const VIBE_MAP = new Map(EVENING_VIBES.map((v) => [v.id, v]));

// ---------------------------------------------------------------------------
// Evening time windows
// ---------------------------------------------------------------------------

export type EveningSlot = "dinner" | "event" | "drinks" | "late_night";

export interface TimeSlot {
  id: EveningSlot;
  label: string;
  defaultTime: string; // HH:MM
  durationMinutes: number;
}

export const EVENING_SLOTS: TimeSlot[] = [
  { id: "dinner", label: "Dinner", defaultTime: "18:30", durationMinutes: 90 },
  { id: "event", label: "Main Event", defaultTime: "20:30", durationMinutes: 120 },
  { id: "drinks", label: "Drinks", defaultTime: "22:30", durationMinutes: 60 },
  { id: "late_night", label: "Late Night", defaultTime: "23:30", durationMinutes: 60 },
];

/** Which vibes include a late-night stop */
export const LATE_NIGHT_VIBES = new Set<EveningVibe>(["adventurous", "group"]);

// ---------------------------------------------------------------------------
// Built evening response types
// ---------------------------------------------------------------------------

export type EveningStop = {
  slot: EveningSlot;
  label: string;
  time: string; // HH:MM
  durationMinutes: number;
  type: "venue" | "event";
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    place_type: string | null;
    image_url: string | null;
    neighborhood: string | null;
  };
  event?: {
    id: number;
    title: string;
    category: string | null;
    image_url: string | null;
  };
  reason: string;
  walkFromPrevious?: {
    minutes: number;
    distanceKm: number;
  };
};

export type BuiltEveningResponse = {
  vibe: EveningVibe;
  date: string;
  partySize: number;
  stops: EveningStop[];
};
