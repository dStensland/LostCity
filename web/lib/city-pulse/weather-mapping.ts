/**
 * Maps weather conditions to venue vibes/types for destination queries.
 *
 * When it's rainy, the feed surfaces cozy indoor spots. On a sunny
 * afternoon, rooftop bars and parks bubble up. This mapping drives
 * the "Weather Discovery" section.
 */

import type { WeatherData, WeatherSignal } from "@/lib/weather-utils";
import { getWeatherSignal } from "@/lib/weather-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeatherVenueFilter {
  /** Venue vibes to include (e.g. "cozy", "lively") */
  vibes: string[];
  /** Venue types to include (e.g. "coffee_shop", "rooftop") */
  venue_types: string[];
  /** Human-readable label for the section */
  label: string;
  /** Short description for the section subtitle */
  subtitle: string;
}

// ---------------------------------------------------------------------------
// Weather → Venue mappings
// ---------------------------------------------------------------------------

const WEATHER_VENUE_MAP: Record<WeatherSignal, WeatherVenueFilter> = {
  rain: {
    vibes: ["intimate", "chill", "craft-cocktails", "artsy"],
    venue_types: [
      "restaurant",
      "bookstore",
      "museum",
      "gallery",
      "library",
      "bar",
      "cocktail_bar",
      "cinema",
      "theater",
      "bowling",
      "arcade",
    ],
    label: "Cozy Spots for a Rainy Day",
    subtitle: "Stay dry and discover somewhere new",
  },
  cold: {
    vibes: ["intimate", "chill", "craft-cocktails", "craft-beer"],
    venue_types: [
      "restaurant",
      "bar",
      "brewery",
      "cocktail_bar",
      "museum",
      "gallery",
      "bookstore",
      "cinema",
      "theater",
    ],
    label: "Warm Up Inside",
    subtitle: "Beat the cold at these cozy spots",
  },
  nice: {
    vibes: ["outdoor-seating", "high-energy", "date-spot", "chill", "rooftop"],
    venue_types: [
      "rooftop",
      "park",
      "brewery",
      "restaurant",
      "amphitheater",
    ],
    label: "Perfect Day to Be Outside",
    subtitle: "The weather's great — get out there",
  },
  hot: {
    vibes: ["chill", "artsy", "casual"],
    venue_types: [
      "restaurant",
      "museum",
      "gallery",
      "cinema",
      "bookstore",
      "library",
      "arcade",
      "bar",
      "cocktail_bar",
    ],
    label: "Cool Off Inside",
    subtitle: "Escape the heat at these spots",
  },
  default: {
    vibes: ["high-energy", "chill", "live-music", "craft-cocktails"],
    venue_types: [
      "restaurant",
      "bar",
      "brewery",
      "museum",
      "gallery",
      "park",
      "rooftop",
    ],
    label: "Explore the City",
    subtitle: "Destinations worth checking out",
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get venue filters based on current weather conditions.
 */
export function getWeatherVenueFilter(
  weather: WeatherData,
): WeatherVenueFilter {
  const signal = getWeatherSignal(weather);
  return WEATHER_VENUE_MAP[signal];
}

/**
 * Build a contextual label for a venue based on weather.
 * Example: "Great patio weather" or "Cozy spot for a rainy day"
 */
export function getWeatherContextLabel(
  weather: WeatherData,
  venueVibes: string[] | null,
  venueType: string | null,
): string | undefined {
  const signal = getWeatherSignal(weather);

  if (signal === "rain") {
    if (venueVibes?.some((v) => v === "intimate" || v === "chill")) {
      return "Cozy spot for a rainy day";
    }
    return "Stay dry here";
  }

  if (signal === "nice") {
    if (venueType === "rooftop" || venueVibes?.includes("rooftop")) {
      return "Perfect rooftop weather";
    }
    if (
      venueType === "park" ||
      venueType === "recreation" ||
      venueVibes?.includes("outdoor-seating")
    ) {
      return "Great day to be outside";
    }
    if (venueVibes?.includes("outdoor-seating")) {
      return "Great patio weather";
    }
  }

  if (signal === "cold") {
    if (venueVibes?.some((v) => v === "intimate" || v === "chill")) {
      return "Warm and cozy inside";
    }
  }

  if (signal === "hot") {
    if (venueType === "restaurant" || venueType === "museum") {
      return "Cool off here";
    }
  }

  // Default signal — generic but useful labels
  if (signal === "default") {
    if (venueType === "rooftop" || venueVibes?.includes("rooftop")) {
      return "Great for an evening out";
    }
    if (venueType === "park" || venueType === "recreation" || venueVibes?.includes("outdoor-seating")) {
      return "Good day to be outside";
    }
    if (venueVibes?.some((v) => v === "chill" || v === "intimate")) {
      return "Cozy neighborhood spot";
    }
    if (venueType === "museum" || venueType === "gallery") {
      return "Worth a visit";
    }
    return "Local favorite";
  }

  return undefined;
}
