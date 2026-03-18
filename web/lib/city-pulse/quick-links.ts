/**
 * Contextual quick links engine for City Pulse.
 *
 * Maps the current moment (time slot + day type + weather) to 4-6
 * shortcut chips that link to pre-filtered Find views. These are
 * access shortcuts, not recommendations — each links to a full
 * result set, not a curated list.
 */

import type { TimeSlot } from "./types";
import type { WeatherSignal } from "@/lib/weather-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickLink {
  label: string;
  /** Phosphor icon name (weight: duotone) */
  icon: string;
  /** Pre-filtered Find view URL (portal slug injected at build time) */
  href: string;
  accent_color: string;
}

type DayType = "weekday" | "weekend";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDayType(dayOfWeek: string): DayType {
  const weekendDays = ["friday", "saturday", "sunday"];
  return weekendDays.includes(dayOfWeek) ? "weekend" : "weekday";
}

function buildHref(portalSlug: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams({ view: "find", type: "events", ...params });
  return `/${portalSlug}?${searchParams.toString()}`;
}

function buildVenueHref(portalSlug: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams({ view: "find", type: "destinations", ...params });
  return `/${portalSlug}?${searchParams.toString()}`;
}

function buildRegularsHref(portalSlug: string, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams({ view: "find", type: "regulars", ...params });
  return `/${portalSlug}?${searchParams.toString()}`;
}


// ---------------------------------------------------------------------------
// Link definitions
// ---------------------------------------------------------------------------

// Each link factory takes a portal slug and returns a QuickLink
type LinkFactory = (portalSlug: string) => QuickLink;

const LINKS = {
  coffee: (p: string): QuickLink => ({
    label: "Coffee",
    icon: "Coffee",
    href: buildVenueHref(p, { venue_type: "restaurant", cuisine: "coffee", open_now: "true", label: "Coffee", tab: "eat-drink" }),
    accent_color: "var(--neon-amber)",
  }),
  brunch: (p: string): QuickLink => ({
    label: "Brunch",
    icon: "ForkKnife",
    href: buildVenueHref(p, { venue_type: "restaurant", cuisine: "brunch_breakfast", open_now: "true", label: "Brunch", tab: "eat-drink" }),
    accent_color: "var(--gold)",
  }),
  morningClasses: (p: string): QuickLink => ({
    label: "Classes",
    icon: "Barbell",
    href: buildHref(p, { categories: "exercise", date: "today" }),
    accent_color: "var(--neon-cyan)",
  }),
  farmersMarkets: (p: string): QuickLink => ({
    label: "Markets",
    icon: "Storefront",
    href: buildHref(p, { categories: "food_drink", genres: "farmers-market", date: "today" }),
    accent_color: "var(--neon-green)",
  }),
  lunch: (p: string): QuickLink => ({
    label: "Lunch Spots",
    icon: "ForkKnife",
    href: buildVenueHref(p, { venue_type: "restaurant,food_hall", open_now: "true", label: "Lunch Spots", tab: "eat-drink" }),
    accent_color: "var(--coral)",
  }),
  todayEvents: (p: string): QuickLink => ({
    label: "Today",
    icon: "CalendarBlank",
    href: buildHref(p, { date: "today" }),
    accent_color: "var(--coral)",
  }),
  freeToday: (p: string): QuickLink => ({
    label: "Free Today",
    icon: "Ticket",
    href: buildHref(p, { date: "today", price: "free" }),
    accent_color: "var(--neon-green)",
  }),
  happyHour: (p: string): QuickLink => ({
    label: "Happy Hour",
    icon: "Wine",
    href: buildRegularsHref(p, { activity: "happy_hour" }),
    accent_color: "#C4B5FD",
  }),
  tonightEvents: (p: string): QuickLink => ({
    label: "Tonight",
    icon: "MoonStars",
    href: buildHref(p, { categories: "music,nightlife,comedy", date: "today" }),
    accent_color: "var(--neon-magenta)",
  }),
  liveMusic: (p: string): QuickLink => ({
    label: "Live Music",
    icon: "MusicNotes",
    href: buildHref(p, { categories: "music", date: "today" }),
    accent_color: "var(--neon-magenta)",
  }),
  comedy: (p: string): QuickLink => ({
    label: "Comedy",
    icon: "SmileyWink",
    href: buildHref(p, { categories: "comedy", date: "today" }),
    accent_color: "var(--gold)",
  }),
  nightlife: (p: string): QuickLink => ({
    label: "Nightlife",
    icon: "Champagne",
    href: buildHref(p, { categories: "nightlife", date: "today" }),
    accent_color: "var(--neon-magenta)",
  }),
  lateNightEats: (p: string): QuickLink => ({
    label: "Late Night Eats",
    icon: "ForkKnife",
    href: buildVenueHref(p, { vibes: "late-night", open_now: "true", label: "Late Night Eats", tab: "eat-drink" }),
    accent_color: "var(--coral)",
  }),
  thisWeekend: (p: string): QuickLink => ({
    label: "This Weekend",
    icon: "CalendarCheck",
    href: buildHref(p, { date: "weekend" }),
    accent_color: "var(--neon-cyan)",
  }),
  outdoors: (p: string): QuickLink => ({
    label: "Outdoors",
    icon: "Park",
    href: buildVenueHref(p, { venue_type: "park,trail,garden", label: "Outdoors", tab: "things-to-do" }),
    accent_color: "var(--neon-green)",
  }),
  patios: (p: string): QuickLink => ({
    label: "Patios",
    icon: "SunHorizon",
    href: buildVenueHref(p, { vibes: "outdoor-seating,rooftop,patio", open_now: "true", label: "Patios" }),
    accent_color: "var(--gold)",
  }),
  museums: (p: string): QuickLink => ({
    label: "Museums",
    icon: "Bank",
    href: buildVenueHref(p, { venue_type: "museum,gallery", label: "Museums", tab: "things-to-do" }),
    accent_color: "var(--neon-cyan)",
  }),
  cozySpots: (p: string): QuickLink => ({
    label: "Cozy Spots",
    icon: "Coffee",
    href: buildVenueHref(p, { vibes: "cozy,intimate", open_now: "true", label: "Cozy Spots", tab: "eat-drink" }),
    accent_color: "var(--neon-amber)",
  }),
  indoorFun: (p: string): QuickLink => ({
    label: "Indoor Fun",
    icon: "GameController",
    href: buildVenueHref(p, { venue_type: "arcade,bowling,cinema,entertainment", label: "Indoor Fun", tab: "things-to-do" }),
    accent_color: "var(--neon-cyan)",
  }),
  family: (p: string): QuickLink => ({
    label: "Family",
    icon: "UsersThree",
    href: buildHref(p, { categories: "family", date: "today" }),
    accent_color: "var(--neon-green)",
  }),
  arts: (p: string): QuickLink => ({
    label: "Art & Culture",
    icon: "PaintBrush",
    href: buildHref(p, { categories: "art", date: "today" }),
    accent_color: "var(--neon-magenta)",
  }),
  tacoTuesday: (p: string): QuickLink => ({
    label: "Taco Spots",
    icon: "ForkKnife",
    href: buildVenueHref(p, { cuisine: "mexican,tex_mex", open_now: "true", label: "Taco Spots", tab: "eat-drink" }),
    accent_color: "var(--gold)",
  }),
  trivia: (p: string): QuickLink => ({
    label: "Trivia",
    icon: "Question",
    href: buildRegularsHref(p, { activity: "trivia" }),
    accent_color: "#93C5FD",
  }),
  gameNight: (p: string): QuickLink => ({
    label: "Game Night",
    icon: "GameController",
    href: buildRegularsHref(p, { activity: "game_night" }),
    accent_color: "#7DD3FC",
  }),
  regularHangs: (p: string): QuickLink => ({
    label: "Regulars",
    icon: "Repeat",
    href: buildRegularsHref(p),
    accent_color: "var(--neon-magenta)",
  }),
  runClub: (p: string): QuickLink => ({
    label: "Run Club",
    icon: "PersonSimpleRun",
    href: buildRegularsHref(p, { activity: "run_club" }),
    accent_color: "#5EEAD4",
  }),
  foodSpecials: (p: string): QuickLink => ({
    label: "Food Specials",
    icon: "ForkKnife",
    href: buildRegularsHref(p, { activity: "food_specials" }),
    accent_color: "#FCD34D",
  }),
  karaoke: (p: string): QuickLink => ({
    label: "Karaoke",
    icon: "Microphone",
    href: buildRegularsHref(p, { activity: "karaoke" }),
    accent_color: "var(--neon-magenta)",
  }),
  openMic: (p: string): QuickLink => ({
    label: "Comedy",
    icon: "Smiley",
    href: buildRegularsHref(p, { activity: "comedy" }),
    accent_color: "var(--coral)",
  }),
  drag: (p: string): QuickLink => ({
    label: "Drag Shows",
    icon: "Sparkle",
    href: buildRegularsHref(p, { activity: "drag" }),
    accent_color: "var(--neon-magenta)",
  }),
  poker: (p: string): QuickLink => ({
    label: "Poker",
    icon: "Club",
    href: buildRegularsHref(p, { activity: "poker" }),
    accent_color: "var(--neon-green)",
  }),
  lineDancing: (p: string): QuickLink => ({
    label: "Line Dancing",
    icon: "MusicNotes",
    href: buildRegularsHref(p, { activity: "dance" }),
    accent_color: "var(--gold)",
  }),
  latinNight: (p: string): QuickLink => ({
    label: "Latin Night",
    icon: "Globe",
    href: buildRegularsHref(p, { activity: "dance" }),
    accent_color: "var(--coral)",
  }),
  danceFitness: (p: string): QuickLink => ({
    label: "Dance & Fitness",
    icon: "Barbell",
    href: buildHref(p, { categories: "exercise,dance", date: "today" }),
    accent_color: "var(--neon-cyan)",
  }),
} satisfies Record<string, LinkFactory>;

// ---------------------------------------------------------------------------
// Time + Day mappings (weather overrides applied after)
// ---------------------------------------------------------------------------

type MomentKey = `${TimeSlot}_${DayType}`;

const MOMENT_LINKS: Record<MomentKey, (keyof typeof LINKS)[]> = {
  // Weekday mornings
  morning_weekday: ["coffee", "brunch", "morningClasses", "runClub", "todayEvents", "freeToday"],
  // Weekend mornings
  morning_weekend: ["brunch", "farmersMarkets", "coffee", "runClub", "family", "freeToday"],
  // Weekday midday
  midday_weekday: ["lunch", "todayEvents", "tonightEvents", "freeToday", "museums"],
  // Weekend midday
  midday_weekend: ["todayEvents", "freeToday", "outdoors", "family", "arts"],
  // Weekday happy hour
  happy_hour_weekday: ["happyHour", "foodSpecials", "tonightEvents", "liveMusic", "trivia", "comedy"],
  // Weekend happy hour
  happy_hour_weekend: ["happyHour", "foodSpecials", "tonightEvents", "liveMusic", "nightlife", "comedy"],
  // Weekday evening
  evening_weekday: ["liveMusic", "trivia", "comedy", "nightlife", "karaoke", "lateNightEats"],
  // Weekend evening
  evening_weekend: ["liveMusic", "nightlife", "comedy", "drag", "karaoke", "lateNightEats"],
  // Late night (same both days)
  late_night_weekday: ["nightlife", "liveMusic", "lateNightEats", "karaoke"],
  late_night_weekend: ["nightlife", "liveMusic", "lateNightEats", "karaoke"],
};

// ---------------------------------------------------------------------------
// Weather overrides
// ---------------------------------------------------------------------------

/** Weather can swap out or inject links to make them more relevant. */
function applyWeatherOverrides(
  links: (keyof typeof LINKS)[],
  weather: WeatherSignal | null,
  timeSlot: TimeSlot,
): (keyof typeof LINKS)[] {
  if (!weather || weather === "default") return links;

  const result = [...links];

  if (weather === "rain" || weather === "cold") {
    // Replace outdoor-oriented links with indoor alternatives
    const outdoorKeys: (keyof typeof LINKS)[] = ["outdoors", "patios", "farmersMarkets"];
    const indoorReplacements: (keyof typeof LINKS)[] = ["cozySpots", "museums", "indoorFun"];

    for (const outdoor of outdoorKeys) {
      const idx = result.indexOf(outdoor);
      if (idx !== -1) {
        const replacement = indoorReplacements.find((r) => !result.includes(r));
        if (replacement) {
          result[idx] = replacement;
        }
      }
    }

    // Inject cozy spots if not already present and there's room
    if (!result.includes("cozySpots") && result.length < 6) {
      result.splice(1, 0, "cozySpots"); // Insert near top
    }
  }

  if (weather === "nice") {
    // Inject outdoor options if not already present
    const morningOrMidday = timeSlot === "morning" || timeSlot === "midday";
    if (morningOrMidday && !result.includes("outdoors")) {
      // Replace the least contextual link (usually the last one)
      if (result.length >= 5) {
        result[result.length - 1] = "outdoors";
      } else {
        result.push("outdoors");
      }
    }
    if (!result.includes("patios") && (timeSlot === "happy_hour" || timeSlot === "midday")) {
      if (result.length >= 5) {
        result[result.length - 1] = "patios";
      } else {
        result.push("patios");
      }
    }
  }

  if (weather === "hot") {
    // Swap outdoors for indoor options
    const idx = result.indexOf("outdoors");
    if (idx !== -1) {
      result[idx] = "indoorFun";
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate contextual quick links for the current moment.
 * Returns 4-6 links tailored to time of day, day of week, and weather.
 */
export function getContextualQuickLinks(
  portalSlug: string,
  timeSlot: TimeSlot,
  dayOfWeek: string,
  weatherSignal: WeatherSignal | null,
): QuickLink[] {
  const dayType = getDayType(dayOfWeek);
  const momentKey: MomentKey = `${timeSlot}_${dayType}`;

  let linkKeys = MOMENT_LINKS[momentKey] || MOMENT_LINKS.midday_weekday;

  // Apply weather overrides
  linkKeys = applyWeatherOverrides(linkKeys, weatherSignal, timeSlot);

  // Day-theme overrides: inject themed links for specific days
  if (dayOfWeek === "tuesday" && !linkKeys.includes("tacoTuesday")) {
    linkKeys.splice(1, 0, "tacoTuesday");
  }
  if (dayOfWeek === "wednesday" && !linkKeys.includes("trivia")) {
    linkKeys.splice(1, 0, "trivia");
  }
  if (dayOfWeek === "thursday" && !linkKeys.includes("karaoke")) {
    linkKeys.splice(2, 0, "karaoke");
  }
  if (dayOfWeek === "friday" && !linkKeys.includes("latinNight")) {
    linkKeys.splice(2, 0, "latinNight");
  }
  if (dayOfWeek === "saturday" && timeSlot === "morning" && !linkKeys.includes("runClub")) {
    linkKeys.splice(1, 0, "runClub");
  }

  // Deduplicate and cap at 6
  const seen = new Set<string>();
  const unique = linkKeys.filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 6).map((key) => LINKS[key](portalSlug));
}
