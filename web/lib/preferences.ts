// Shared preference options for user onboarding and settings

export const PREFERENCE_CATEGORIES = [
  { value: "music", label: "Music", icon: "music" },
  { value: "film", label: "Film", icon: "film" },
  { value: "comedy", label: "Comedy", icon: "comedy" },
  { value: "theater", label: "Theater", icon: "theater" },
  { value: "art", label: "Art", icon: "art" },
  { value: "sports", label: "Sports", icon: "sports" },
  { value: "food_drink", label: "Food & Drink", icon: "food_drink" },
  { value: "nightlife", label: "Nightlife", icon: "nightlife" },
  { value: "community", label: "Community", icon: "community" },
  { value: "fitness", label: "Fitness", icon: "fitness" },
  { value: "family", label: "Family", icon: "family" },
  { value: "meetup", label: "Meetup", icon: "meetup" },
  { value: "words", label: "Words", icon: "words" },
] as const;

export const PREFERENCE_NEIGHBORHOODS = [
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
] as const;

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
