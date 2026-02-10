// Shared preference options for user onboarding and settings

import { PREFERENCE_NEIGHBORHOOD_NAMES } from "@/config/neighborhoods";

export const PREFERENCE_CATEGORIES = [
  { value: "music", label: "Music", icon: "music", emoji: "🎵" },
  { value: "comedy", label: "Comedy", icon: "comedy", emoji: "😂" },
  { value: "art", label: "Art", icon: "art", emoji: "🎨" },
  { value: "theater", label: "Theater", icon: "theater", emoji: "🎭" },
  { value: "film", label: "Film", icon: "film", emoji: "🎬" },
  { value: "food_drink", label: "Food & Drink", icon: "food_drink", emoji: "🍽️" },
  { value: "nightlife", label: "Nightlife", icon: "nightlife", emoji: "🌙" },
  { value: "sports", label: "Sports", icon: "sports", emoji: "⚽" },
  { value: "community", label: "Community", icon: "community", emoji: "🤝" },
  { value: "fitness", label: "Fitness", icon: "fitness", emoji: "💪" },
  { value: "family", label: "Family", icon: "family", emoji: "👨‍👩‍👧" },
  { value: "meetup", label: "Meetup", icon: "meetup", emoji: "👋" },
  { value: "words", label: "Words", icon: "words", emoji: "📚" },
] as const;

// Subcategories organized by parent category
export const PREFERENCE_SUBCATEGORIES: Record<string, { value: string; label: string }[]> = {
  music: [
    { value: "music.live", label: "Live Music" },
    { value: "music.rock_indie", label: "Rock/Indie" },
    { value: "music.hip_hop", label: "Hip-Hop" },
    { value: "music.electronic", label: "Electronic/DJ" },
    { value: "music.jazz_blues", label: "Jazz/Blues" },
    { value: "music.country_folk", label: "Country/Folk" },
    { value: "music.classical", label: "Classical" },
    { value: "music.open_mic", label: "Open Mic" },
  ],
  comedy: [
    { value: "comedy.standup", label: "Stand-Up" },
    { value: "comedy.improv", label: "Improv" },
    { value: "comedy.open_mic", label: "Open Mic" },
    { value: "comedy.sketch", label: "Sketch" },
  ],
  art: [
    { value: "art.gallery", label: "Gallery Opening" },
    { value: "art.workshop", label: "Art Workshop" },
    { value: "art.market", label: "Art Market" },
    { value: "art.street", label: "Street Art" },
  ],
  theater: [
    { value: "theater.play", label: "Play" },
    { value: "theater.musical", label: "Musical" },
    { value: "theater.dance", label: "Dance" },
    { value: "theater.opera", label: "Opera" },
  ],
  film: [
    { value: "film.screening", label: "Film Screening" },
    { value: "film.indie", label: "Indie Film" },
    { value: "film.documentary", label: "Documentary" },
    { value: "film.horror", label: "Horror Night" },
  ],
  food_drink: [
    { value: "food_drink.tasting", label: "Tasting" },
    { value: "food_drink.brunch", label: "Brunch" },
    { value: "food_drink.happy_hour", label: "Happy Hour" },
    { value: "food_drink.popup", label: "Pop-up" },
  ],
  nightlife: [
    { value: "nightlife.club", label: "Club Night" },
    { value: "nightlife.bar", label: "Bar Event" },
    { value: "nightlife.karaoke", label: "Karaoke" },
    { value: "nightlife.drag", label: "Drag Show" },
  ],
  sports: [
    { value: "sports.watch_party", label: "Watch Party" },
    { value: "sports.pickup", label: "Pickup Game" },
    { value: "sports.league", label: "League" },
    { value: "sports.outdoors", label: "Outdoor Sports" },
  ],
};

// Categories that have subcategories available
export const CATEGORIES_WITH_SUBCATEGORIES = Object.keys(PREFERENCE_SUBCATEGORIES);

/**
 * @deprecated Import PREFERENCE_NEIGHBORHOOD_NAMES from @/config/neighborhoods instead
 * Kept for backwards compatibility - this is now derived from the canonical config.
 */
export const PREFERENCE_NEIGHBORHOODS = PREFERENCE_NEIGHBORHOOD_NAMES;

export const PREFERENCE_VIBES = [
  { value: "late-night", label: "Late Night", group: "Atmosphere" },
  { value: "date-spot", label: "Date Spot", group: "Atmosphere" },
  { value: "divey", label: "Divey", group: "Atmosphere" },
  { value: "intimate", label: "Intimate", group: "Atmosphere" },
  { value: "upscale", label: "Upscale", group: "Atmosphere" },
  { value: "casual", label: "Casual", group: "Atmosphere" },
  { value: "artsy", label: "Artsy", group: "Atmosphere" },
  { value: "outdoor-seating", label: "Outdoor", group: "Amenities" },
  { value: "live-music", label: "Live Music", group: "Amenities" },
  { value: "good-for-groups", label: "Groups", group: "Amenities" },
  { value: "rooftop", label: "Rooftop", group: "Amenities" },
  { value: "all-ages", label: "All Ages", group: "Access" },
  { value: "family-friendly", label: "Family Friendly", group: "Access" },
  { value: "dog-friendly", label: "Dog Friendly", group: "Access" },
] as const;

export const PRICE_PREFERENCES = [
  { value: "free", label: "Free events only" },
  { value: "budget", label: "Budget-friendly (under $25)" },
  { value: "any", label: "Any price" },
] as const;

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number]["value"];
export type PreferenceNeighborhood = (typeof PREFERENCE_NEIGHBORHOODS)[number];
export type PreferenceVibe = (typeof PREFERENCE_VIBES)[number]["value"];
export type PricePreference = (typeof PRICE_PREFERENCES)[number]["value"];

// Genre display labels for prettier rendering of slugs
export const GENRE_DISPLAY_LABELS: Record<string, string> = {
  "r-and-b": "R&B",
  "hip-hop": "Hip-Hop",
  "lo-fi": "Lo-Fi",
  "dj-set": "DJ Set",
  "sci-fi": "Sci-Fi",
  "k-pop": "K-Pop",
  "j-pop": "J-Pop",
  "neo-soul": "Neo-Soul",
  "open-mic": "Open Mic",
  "stand-up": "Stand-Up",
  "pop-up": "Pop-Up",
  "drag-show": "Drag Show",
  "watch-party": "Watch Party",
  "happy-hour": "Happy Hour",
  "spoken-word": "Spoken Word",
  "singer-songwriter": "Singer-Songwriter",
};

/**
 * Returns a display-friendly label for a genre slug.
 * Falls back to title-casing the slug if no override exists.
 */
export function getGenreDisplayLabel(slug: string): string {
  if (GENRE_DISPLAY_LABELS[slug]) return GENRE_DISPLAY_LABELS[slug];
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Needs preferences — accessibility, dietary, family
export const PREFERENCE_NEEDS_ACCESSIBILITY = [
  { value: "wheelchair", label: "Wheelchair Accessible" },
  { value: "elevator", label: "Elevator Access" },
  { value: "hearing-loop", label: "Hearing Loop" },
  { value: "asl", label: "ASL Interpreted" },
  { value: "sensory-friendly", label: "Sensory-Friendly" },
  { value: "service-animals", label: "Service Animals Welcome" },
] as const;

export const PREFERENCE_NEEDS_DIETARY = [
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "nut-free", label: "Nut-Free" },
] as const;

export const PREFERENCE_NEEDS_FAMILY = [
  { value: "kid-friendly", label: "Kid-Friendly" },
  { value: "stroller", label: "Stroller Accessible" },
  { value: "changing-table", label: "Changing Table" },
  { value: "nursing-room", label: "Nursing Room" },
] as const;

// Discovery Mode onboarding mood mappings
export type OnboardingMood = "chill" | "wild" | "social" | "culture";

export const ONBOARDING_MOODS = [
  {
    value: "chill" as const,
    label: "Chill",
    emoji: "🌙",
    description: "Laid-back vibes, comedy, film nights",
    categories: ["comedy", "film", "words"] as PreferenceCategory[],
    vibes: ["casual", "intimate", "date-spot"] as PreferenceVibe[],
  },
  {
    value: "wild" as const,
    label: "Wild",
    emoji: "🔥",
    description: "Live music, dancing, nightlife",
    categories: ["music", "nightlife"] as PreferenceCategory[],
    vibes: ["late-night", "live-music"] as PreferenceVibe[],
  },
  {
    value: "social" as const,
    label: "Social",
    emoji: "🎉",
    description: "Group hangs, food, meetups, sports",
    categories: ["food_drink", "meetup", "sports"] as PreferenceCategory[],
    vibes: ["good-for-groups"] as PreferenceVibe[],
  },
  {
    value: "culture" as const,
    label: "Culture",
    emoji: "🎭",
    description: "Art, theater, upscale experiences",
    categories: ["art", "theater"] as PreferenceCategory[],
    vibes: ["artsy", "upscale"] as PreferenceVibe[],
  },
] as const;

// Helper to get mood config by value
export function getMoodConfig(mood: OnboardingMood) {
  return ONBOARDING_MOODS.find((m) => m.value === mood);
}
