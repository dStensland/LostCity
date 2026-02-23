/**
 * Default editorial content for the feed header.
 *
 * These pure functions are the algorithm defaults — they run when
 * no CMS override is active (or when CMS fields are null).
 * Extracted from GreetingBar.tsx so they're importable server-side.
 */

import type { FeedContext, TimeSlot } from "./types";

// ---------------------------------------------------------------------------
// Editorial headline cascade
// ---------------------------------------------------------------------------

export function getEditorialHeadline(context: FeedContext): string {
  const { time_slot, day_theme, weather, active_holidays, active_festivals, weather_signal } = context;

  if (active_holidays.length > 0) {
    return active_holidays[0].title;
  }

  if (active_festivals.length > 0) {
    return `${active_festivals[0].name} is happening now`;
  }

  if (weather_signal === "rain") {
    return "Rainy day — cozy spots await";
  }
  if (weather && weather.temperature_f >= 80) {
    return "Hot out there — find your cool";
  }
  if (weather && weather.temperature_f >= 65 && weather_signal === "nice") {
    return `${Math.round(weather.temperature_f)}° and sunny — get outside`;
  }

  switch (day_theme) {
    case "taco_tuesday":
      return "Happy Taco Tuesday";
    case "wine_wednesday":
      return "Wine Wednesday vibes";
    case "thirsty_thursday":
      return time_slot === "happy_hour" || time_slot === "evening"
        ? "Thirsty Thursday is here"
        : "Thursday — weekend's almost here";
    case "friday_night":
      return time_slot === "evening" || time_slot === "late_night"
        ? "Friday night in Atlanta"
        : "It's Friday — make plans";
    case "brunch_weekend":
      return "Brunch time — where to?";
    case "saturday_night":
      return "Saturday night — the city's alive";
    case "sunday_funday":
      return "Sunday Funday";
  }

  switch (time_slot) {
    case "morning":
      return "Good morning, Atlanta";
    case "midday":
      return "Good afternoon";
    case "happy_hour":
      return "It's happy hour";
    case "evening":
      return "Good evening";
    case "late_night":
      return "Late night in Atlanta";
  }
}

// ---------------------------------------------------------------------------
// City photo mapping
// ---------------------------------------------------------------------------

// Atlanta photos curated per time slot. All verified & free to use.
// Multiple options per slot — caller picks by day-of-week for variety.
const HEADER_PHOTOS: Record<TimeSlot, string[]> = {
  morning: [
    "/portals/atlanta/jackson-st-bridge.jpg",
    "https://images.unsplash.com/photo-1702494600481-043a92b6271e?w=1200&q=80&fit=crop&auto=format", // Piedmont Park lake + Midtown
    "https://images.unsplash.com/photo-1589414480645-9c552d67f352?w=1200&q=80&fit=crop&auto=format", // Piedmont Park golden hour
    "https://images.unsplash.com/photo-1541655446662-baff34d3288a?w=1200&q=80&fit=crop&auto=format", // Ponce City Market exterior
  ],
  midday: [
    "https://images.pexels.com/photos/33133734/pexels-photo-33133734.jpeg?w=1200&h=630&fit=crop", // ATL aerial skyline
    "https://images.pexels.com/photos/5063779/pexels-photo-5063779.jpeg?w=1200&h=630&fit=crop", // Downtown towers blue sky
    "https://images.pexels.com/photos/33133744/pexels-photo-33133744.jpeg?w=1200&h=630&fit=crop", // MBS Stadium aerial
    "https://images.unsplash.com/photo-1506833913194-a9d027e04686?w=1200&q=80&fit=crop&auto=format", // Ponce City Market north
  ],
  happy_hour: [
    "https://images.unsplash.com/photo-1753744402410-44319f72f8c5?w=1200&q=80&fit=crop&auto=format", // Aerial with SkyView Ferris wheel
    "https://images.pexels.com/photos/11599618/pexels-photo-11599618.jpeg?w=1200&h=630&fit=crop", // ATL sunset skyline
    "https://images.unsplash.com/photo-1633142253214-3100edb4f670?w=1200&q=80&fit=crop&auto=format", // Ponce neon sign
    "https://images.unsplash.com/photo-1543171215-1beb7b8b0ecb?w=1200&q=80&fit=crop&auto=format", // Atlanta signage mural
  ],
  evening: [
    "https://images.unsplash.com/photo-1736512642636-423ec6799e76?w=1200&q=80&fit=crop&auto=format", // Snowy Piedmont + skyline
    "https://images.pexels.com/photos/17056802/pexels-photo-17056802.jpeg?w=1200&h=630&fit=crop", // Peachtree Center district
    "https://images.pexels.com/photos/164400/pexels-photo-164400.jpeg?w=1200&h=630&fit=crop", // ATL panoramic cityscape
    "/portals/atlanta/header-bg.jpg",
  ],
  late_night: [
    "https://images.unsplash.com/photo-1704223058918-dbfa9b73eea2?w=1200&q=80&fit=crop&auto=format", // Aerial Midtown night glow
    "https://images.unsplash.com/photo-1703811096376-1cb9f563961d?w=1200&q=80&fit=crop&auto=format", // Aerial highway interchange night
    "https://images.pexels.com/photos/31222634/pexels-photo-31222634.jpeg?w=1200&h=630&fit=crop", // B&W skyline
    "/portals/atlanta/header-bg-skyline.jpg",
  ],
};

const RAIN_PHOTOS = [
  "/portals/atlanta/header-bg-rain-crop.jpg",
];

export function getCityPhoto(timeSlot: TimeSlot, weatherSignal?: string, dayOfWeek?: string): string {
  // Rain override
  if (weatherSignal === "rain") {
    const dayIdx = dayOfWeek ? DAY_INDICES[dayOfWeek] ?? 0 : 0;
    return RAIN_PHOTOS[dayIdx % RAIN_PHOTOS.length];
  }

  const photos = HEADER_PHOTOS[timeSlot];
  // Rotate by day of week for variety
  const dayIdx = dayOfWeek ? DAY_INDICES[dayOfWeek] ?? 0 : 0;
  return photos[dayIdx % photos.length];
}

const DAY_INDICES: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

// ---------------------------------------------------------------------------
// Default accent color
// ---------------------------------------------------------------------------

export function getDefaultAccentColor(context: FeedContext): string {
  if (context.active_holidays.length > 0) {
    return context.active_holidays[0].accent_color;
  }
  return "var(--coral)";
}

// ---------------------------------------------------------------------------
// Time label helpers (for template variable resolution)
// ---------------------------------------------------------------------------

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "this morning",
  midday: "this afternoon",
  happy_hour: "this evening",
  evening: "tonight",
  late_night: "tonight",
};

export function getTimeLabel(timeSlot: TimeSlot): string {
  return TIME_SLOT_LABELS[timeSlot];
}
