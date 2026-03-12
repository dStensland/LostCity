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

// Atlanta photos curated per time slot. All Unsplash/Pexels (free to use).
// 7-8 options per slot — caller picks by day-of-week for daily variety.
const HEADER_PHOTOS: Record<TimeSlot, string[]> = {
  morning: [
    "/portals/atlanta/jackson-st-bridge.jpg",
    "https://images.unsplash.com/photo-1702494600481-043a92b6271e?w=1200&q=80&fit=crop&auto=format", // Piedmont Park lake + Midtown
    "https://images.unsplash.com/photo-1589414480645-9c552d67f352?w=1200&q=80&fit=crop&auto=format", // Piedmont Park golden hour
    "https://images.unsplash.com/photo-1541655446662-baff34d3288a?w=1200&q=80&fit=crop&auto=format", // Ponce City Market exterior
    "https://images.unsplash.com/photo-1610741686854-5948cd981569?w=1200&q=80&fit=crop&auto=format", // City skyline blue sky daytime
    "https://images.unsplash.com/photo-1733306598042-61022ae91155?w=1200&q=80&fit=crop&auto=format", // Panoramic from Jackson Street Bridge
    "https://images.pexels.com/photos/2815170/pexels-photo-2815170.jpeg?w=1200&h=630&fit=crop", // Aerial skyscrapers + lush greenery
    "https://images.pexels.com/photos/2815167/pexels-photo-2815167.jpeg?w=1200&h=630&fit=crop", // Aerial Atlanta clear blue skies
  ],
  midday: [
    "https://images.pexels.com/photos/33133734/pexels-photo-33133734.jpeg?w=1200&h=630&fit=crop", // ATL aerial skyline
    "https://images.pexels.com/photos/5063779/pexels-photo-5063779.jpeg?w=1200&h=630&fit=crop", // Downtown towers blue sky
    "https://images.pexels.com/photos/33133744/pexels-photo-33133744.jpeg?w=1200&h=630&fit=crop", // MBS Stadium aerial
    "https://images.unsplash.com/photo-1506833913194-a9d027e04686?w=1200&q=80&fit=crop&auto=format", // Ponce City Market north
    "https://images.unsplash.com/photo-1697729751156-68f01255334c?w=1200&q=80&fit=crop&auto=format", // Drone downtown + Centennial Park
    "https://images.unsplash.com/photo-1733306498673-bae21ab4560a?w=1200&q=80&fit=crop&auto=format", // Downtown skyline and traffic
    "https://images.pexels.com/photos/2815184/pexels-photo-2815184.jpeg?w=1200&h=630&fit=crop", // Aerial downtown skyline daytime
  ],
  happy_hour: [
    "https://images.unsplash.com/photo-1753744402410-44319f72f8c5?w=1200&q=80&fit=crop&auto=format", // Aerial with SkyView Ferris wheel
    "https://images.pexels.com/photos/11599618/pexels-photo-11599618.jpeg?w=1200&h=630&fit=crop", // ATL sunset skyline
    "https://images.unsplash.com/photo-1633142253214-3100edb4f670?w=1200&q=80&fit=crop&auto=format", // Ponce neon sign
    "https://images.unsplash.com/photo-1543171215-1beb7b8b0ecb?w=1200&q=80&fit=crop&auto=format", // Atlanta signage mural
    "https://images.unsplash.com/photo-1473042904451-00171c69419d?w=1200&q=80&fit=crop&auto=format", // Highway timelapse golden hour
    "https://images.unsplash.com/photo-1675449672066-db3b9a6cd717?w=1200&q=80&fit=crop&auto=format", // City with Ferris wheel at dusk
    "https://images.pexels.com/photos/33133726/pexels-photo-33133726.jpeg?w=1200&h=630&fit=crop", // Aerial skyline at dusk
    "https://images.pexels.com/photos/16117735/pexels-photo-16117735.jpeg?w=1200&h=630&fit=crop", // Urban street view at dusk
  ],
  evening: [
    "https://images.unsplash.com/photo-1736512642636-423ec6799e76?w=1200&q=80&fit=crop&auto=format", // Snowy Piedmont + skyline
    "https://images.pexels.com/photos/17056802/pexels-photo-17056802.jpeg?w=1200&h=630&fit=crop", // Peachtree Center district
    "https://images.pexels.com/photos/33133724/pexels-photo-33133724.jpeg?w=1200&h=630&fit=crop", // Atlanta skyline at night illuminated
    "/portals/atlanta/header-bg.jpg",
    "https://images.pexels.com/photos/12181718/pexels-photo-12181718.jpeg?w=1200&h=630&fit=crop", // Skyline illuminated buildings + highway
    "https://images.pexels.com/photos/31127397/pexels-photo-31127397.jpeg?w=1200&h=630&fit=crop", // Evening skyline illuminated skyscrapers
    "https://images.pexels.com/photos/33133739/pexels-photo-33133739.jpeg?w=1200&h=630&fit=crop", // Panoramic skyline with Ferris wheel
  ],
  late_night: [
    "https://images.unsplash.com/photo-1704223058918-dbfa9b73eea2?w=1200&q=80&fit=crop&auto=format", // Aerial Midtown night glow
    "https://images.unsplash.com/photo-1703811096376-1cb9f563961d?w=1200&q=80&fit=crop&auto=format", // Aerial highway interchange night
    "https://images.pexels.com/photos/31222634/pexels-photo-31222634.jpeg?w=1200&h=630&fit=crop", // B&W skyline moody
    "/portals/atlanta/header-bg-skyline.jpg",
    "https://images.unsplash.com/photo-1634010727710-aeef03fa4cba?w=1200&q=80&fit=crop&auto=format", // Aerial city at night
    "https://images.pexels.com/photos/31025632/pexels-photo-31025632.jpeg?w=1200&h=630&fit=crop", // Night light trails on highway
    "https://images.pexels.com/photos/302716/pexels-photo-302716.jpeg?w=1200&h=630&fit=crop", // Night glowing city + traffic trails
    "https://images.pexels.com/photos/134643/pexels-photo-134643.jpeg?w=1200&h=630&fit=crop", // Night cityscape light trails
  ],
};

const RAIN_PHOTOS = [
  "/portals/atlanta/header-bg-rain-crop.jpg",
  "/portals/atlanta/header-bg-rain.jpg",
  "https://images.pexels.com/photos/31222634/pexels-photo-31222634.jpeg?w=1200&h=630&fit=crop", // B&W skyline — moody
  "/portals/atlanta/header-bg-skyline.jpg",
  "https://images.pexels.com/photos/302716/pexels-photo-302716.jpeg?w=1200&h=630&fit=crop", // Moody night glow
  "https://images.pexels.com/photos/134643/pexels-photo-134643.jpeg?w=1200&h=630&fit=crop", // Dark cityscape light trails
  "https://images.unsplash.com/photo-1634010727710-aeef03fa4cba?w=1200&q=80&fit=crop&auto=format", // Aerial night — moody
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
