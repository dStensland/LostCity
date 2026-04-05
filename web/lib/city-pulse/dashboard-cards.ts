/**
 * Dashboard card engine for the GreetingBar.
 *
 * Returns 3 context-driven cards based on time-of-day, weather,
 * and day-of-week. Cards link to Find views with pre-set filters.
 */

import type { DashboardCard, TimeSlot, FeedContext } from "./types";
import { buildExploreUrl } from "@/lib/find-url";

type CardTemplate = Omit<DashboardCard, "id"> & { id: string };

function buildCardHref(
  portalSlug: string,
  lane: string,
  extraParams: Record<string, string | boolean>,
): string {
  return buildExploreUrl({
    portalSlug,
    lane,
    extraParams,
  });
}

// ---------------------------------------------------------------------------
// Card templates by context
// ---------------------------------------------------------------------------

const CARDS = {
  coffee: (slug: string): CardTemplate => ({
    id: "coffee",
    label: "Coffee spots",
    value: "Open now",
    icon: "Coffee",
    href: buildCardHref(slug, "places", {
      venue_type: "restaurant",
      cuisine: "coffee",
      open_now: true,
      tab: "eat-drink",
      label: "Coffee",
    }),
  }),
  morning_walk: (slug: string): CardTemplate => ({
    id: "morning_walk",
    label: "Morning walk",
    value: "BeltLine & trails",
    icon: "PersonSimpleWalk",
    href: buildCardHref(slug, "places", {
      venue_type: "park,trail,garden",
      tab: "things-to-do",
      label: "Parks & Trails",
    }),
  }),
  farmers_market: (slug: string): CardTemplate => ({
    id: "farmers_market",
    label: "Markets",
    value: "This weekend",
    icon: "Storefront",
    href: buildCardHref(slug, "events", {
      categories: "food_drink",
      genres: "farmers-market",
      date: "today",
    }),
  }),
  parks: (slug: string): CardTemplate => ({
    id: "parks",
    label: "Parks & outdoors",
    value: "Near you",
    icon: "Tree",
    href: buildCardHref(slug, "places", {
      venue_type: "park,trail,garden",
      tab: "things-to-do",
      label: "Parks",
    }),
  }),
  patio: (slug: string): CardTemplate => ({
    id: "patio",
    label: "Patio bars",
    value: "Open now",
    icon: "SunHorizon",
    href: buildCardHref(slug, "places", {
      vibes: "outdoor-seating,rooftop,patio",
      open_now: true,
      tab: "eat-drink",
      label: "Patios",
    }),
    accent: "var(--gold)",
  }),
  beltline: (slug: string): CardTemplate => ({
    id: "beltline",
    label: "BeltLine",
    value: "Open now",
    icon: "Path",
    href: buildCardHref(slug, "places", {
      neighborhoods: "Old Fourth Ward,Inman Park,Reynoldstown,Grant Park",
      open_now: true,
      tab: "things-to-do",
      label: "BeltLine",
    }),
  }),
  live_music: (slug: string): CardTemplate => ({
    id: "live_music",
    label: "Live music",
    value: "Tonight",
    icon: "MusicNotes",
    href: buildCardHref(slug, "events", {
      categories: "music",
      date: "today",
    }),
    accent: "var(--coral)",
  }),
  nightlife: (slug: string): CardTemplate => ({
    id: "nightlife",
    label: "Going Out",
    value: "Trending",
    icon: "Martini",
    href: buildCardHref(slug, "events", {
      categories: "games,dance",
      date: "today",
    }),
    accent: "var(--neon-magenta)",
  }),
  late_night: (slug: string): CardTemplate => ({
    id: "late_night",
    label: "Late night eats",
    value: "Open now",
    icon: "ForkKnife",
    href: buildCardHref(slug, "places", {
      vibes: "late-night",
      open_now: true,
      tab: "eat-drink",
      label: "Late Night Eats",
    }),
  }),
  indoor: (slug: string): CardTemplate => ({
    id: "indoor",
    label: "Indoor vibes",
    value: "Stay dry",
    icon: "Umbrella",
    href: buildCardHref(slug, "places", {
      venue_type: "museum,gallery,entertainment,arcade,bowling,cinema",
      tab: "things-to-do",
      label: "Indoor Vibes",
    }),
  }),
  happy_hour: (slug: string): CardTemplate => ({
    id: "happy_hour",
    label: "Happy hours",
    value: "Active now",
    icon: "BeerStein",
    href: buildCardHref(slug, "places", {
      venue_type: "bar,brewery,restaurant",
      open_now: true,
      tab: "eat-drink",
      label: "Happy Hour",
    }),
    accent: "var(--gold)",
  }),
  museums: (slug: string): CardTemplate => ({
    id: "museums",
    label: "Museums",
    value: "Open now",
    icon: "Bank",
    href: buildCardHref(slug, "places", {
      venue_type: "museum,gallery",
      tab: "things-to-do",
      label: "Museums",
    }),
  }),
  brunch: (slug: string): CardTemplate => ({
    id: "brunch",
    label: "Brunch",
    value: "Open now",
    icon: "Egg",
    href: buildCardHref(slug, "places", {
      venue_type: "restaurant",
      cuisine: "brunch_breakfast",
      open_now: true,
      tab: "eat-drink",
      label: "Brunch",
    }),
    accent: "var(--gold)",
  }),
  food_events: (slug: string): CardTemplate => ({
    id: "food_events",
    label: "Food & drink",
    value: "Today",
    icon: "CookingPot",
    href: buildCardHref(slug, "events", {
      categories: "food_drink",
      date: "today",
    }),
  }),
  comedy: (slug: string): CardTemplate => ({
    id: "comedy",
    label: "Comedy",
    value: "Tonight",
    icon: "SmileyWink",
    href: buildCardHref(slug, "events", {
      categories: "comedy",
      date: "today",
    }),
  }),
} as const;

// ---------------------------------------------------------------------------
// Context matrix: [time_slot + weather_signal] → 3 cards
// ---------------------------------------------------------------------------

type CardKey = keyof typeof CARDS;

interface CardSelection {
  normal: [CardKey, CardKey, CardKey];
  rain: [CardKey, CardKey, CardKey];
}

const CARD_MATRIX: Record<TimeSlot, CardSelection> = {
  morning: {
    normal: ["coffee", "morning_walk", "farmers_market"],
    rain: ["coffee", "indoor", "museums"],
  },
  midday: {
    normal: ["parks", "patio", "food_events"],
    rain: ["indoor", "museums", "food_events"],
  },
  happy_hour: {
    normal: ["happy_hour", "patio", "live_music"],
    rain: ["happy_hour", "indoor", "comedy"],
  },
  evening: {
    normal: ["live_music", "nightlife", "late_night"],
    rain: ["live_music", "indoor", "late_night"],
  },
  late_night: {
    normal: ["nightlife", "late_night", "comedy"],
    rain: ["nightlife", "late_night", "indoor"],
  },
};

// Weekend morning override
const WEEKEND_MORNING: CardSelection = {
  normal: ["brunch", "farmers_market", "parks"],
  rain: ["brunch", "museums", "indoor"],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getDashboardCards(context: FeedContext, portalSlug: string): DashboardCard[] {
  const isWeekend = context.day_of_week === "saturday" || context.day_of_week === "sunday";
  const isRain = context.weather_signal === "rain";

  let selection: CardSelection;

  if (isWeekend && (context.time_slot === "morning" || context.time_slot === "midday")) {
    selection = WEEKEND_MORNING;
  } else {
    selection = CARD_MATRIX[context.time_slot];
  }

  const keys = isRain ? selection.rain : selection.normal;

  return keys.map((key) => CARDS[key](portalSlug));
}
