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

// ---------------------------------------------------------------------------
// Link definitions
// ---------------------------------------------------------------------------

// Each link factory takes a portal slug and returns a QuickLink
type LinkFactory = (portalSlug: string) => QuickLink;

const LINKS = {
  coffee: (p: string): QuickLink => ({
    label: "Coffee",
    icon: "Coffee",
    href: buildVenueHref(p, { venue_type: "restaurant", cuisine: "coffee", label: "Coffee", tab: "eat-drink" }),
    accent_color: "var(--neon-amber)",
  }),
  brunch: (p: string): QuickLink => ({
    label: "Brunch",
    icon: "ForkKnife",
    href: buildVenueHref(p, { venue_type: "restaurant", cuisine: "brunch_breakfast", label: "Brunch", tab: "eat-drink" }),
    accent_color: "var(--gold)",
  }),
  morningClasses: (p: string): QuickLink => ({
    label: "Classes",
    icon: "Barbell",
    href: buildHref(p, { categories: "fitness", date: "today" }),
    accent_color: "var(--neon-cyan)",
  }),
  farmersMarkets: (p: string): QuickLink => ({
    label: "Markets",
    icon: "Storefront",
    href: buildHref(p, { categories: "food_drink", tags: "market,farmers-market", date: "today" }),
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
    icon: "BeerStein",
    href: buildVenueHref(p, { venue_type: "bar,brewery,restaurant", open_now: "true", label: "Happy Hour", tab: "eat-drink" }),
    accent_color: "var(--neon-amber)",
  }),
  tonightEvents: (p: string): QuickLink => ({
    label: "Tonight",
    icon: "MoonStars",
    href: buildHref(p, { date: "today", time_after: "17:00" }),
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
    href: buildVenueHref(p, { vibes: "late-night", label: "Late Night Eats", tab: "eat-drink" }),
    accent_color: "var(--coral)",
  }),
  thisWeekend: (p: string): QuickLink => ({
    label: "This Weekend",
    icon: "CalendarCheck",
    href: buildHref(p, { date: "this_weekend" }),
    accent_color: "var(--neon-cyan)",
  }),
  outdoors: (p: string): QuickLink => ({
    label: "Outdoors",
    icon: "Park",
    href: buildVenueHref(p, { venue_type: "park,garden,outdoor_venue", label: "Outdoors", tab: "things-to-do" }),
    accent_color: "var(--neon-green)",
  }),
  patios: (p: string): QuickLink => ({
    label: "Patios",
    icon: "SunHorizon",
    href: buildVenueHref(p, { vibes: "outdoor-seating,rooftop,patio", label: "Patios" }),
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
    href: buildVenueHref(p, { vibes: "cozy,intimate", label: "Cozy Spots", tab: "eat-drink" }),
    accent_color: "var(--neon-amber)",
  }),
  indoorFun: (p: string): QuickLink => ({
    label: "Indoor Fun",
    icon: "GameController",
    href: buildVenueHref(p, { venue_type: "arcade,bowling,cinema", label: "Indoor Fun", tab: "things-to-do" }),
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
    href: buildHref(p, { categories: "art" }),
    accent_color: "var(--neon-magenta)",
  }),
} satisfies Record<string, LinkFactory>;

// ---------------------------------------------------------------------------
// Time + Day mappings (weather overrides applied after)
// ---------------------------------------------------------------------------

type MomentKey = `${TimeSlot}_${DayType}`;

const MOMENT_LINKS: Record<MomentKey, (keyof typeof LINKS)[]> = {
  // Weekday mornings
  morning_weekday: ["coffee", "brunch", "morningClasses", "todayEvents", "freeToday"],
  // Weekend mornings
  morning_weekend: ["brunch", "farmersMarkets", "coffee", "family", "freeToday"],
  // Weekday midday
  midday_weekday: ["lunch", "todayEvents", "tonightEvents", "freeToday", "museums"],
  // Weekend midday
  midday_weekend: ["todayEvents", "freeToday", "outdoors", "family", "arts"],
  // Weekday happy hour
  happy_hour_weekday: ["happyHour", "tonightEvents", "liveMusic", "comedy", "freeToday"],
  // Weekend happy hour
  happy_hour_weekend: ["happyHour", "tonightEvents", "liveMusic", "nightlife", "comedy"],
  // Weekday evening
  evening_weekday: ["liveMusic", "comedy", "nightlife", "lateNightEats", "freeToday"],
  // Weekend evening
  evening_weekend: ["liveMusic", "nightlife", "comedy", "lateNightEats", "freeToday"],
  // Late night (same both days)
  late_night_weekday: ["nightlife", "liveMusic", "lateNightEats", "comedy"],
  late_night_weekend: ["nightlife", "liveMusic", "lateNightEats", "comedy"],
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

  // Deduplicate and cap at 6
  const seen = new Set<string>();
  const unique = linkKeys.filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 6).map((key) => LINKS[key](portalSlug));
}
