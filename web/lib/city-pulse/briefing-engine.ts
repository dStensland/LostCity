/**
 * Briefing Template Composition Engine
 *
 * Synthesizes weather, major events, openings/closings, holidays, and
 * calendar signals into editorial prose for the CityPulse feed header.
 *
 * Pure function — no side effects, no database calls.
 * Uses a greedy priority chain: first signal above threshold = headline
 * clause, second signal = supporting clause.
 */

import type { BriefingOutput } from "./types";
import { buildExploreUrl } from "@/lib/find-url";

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

export interface BriefingContext {
  tentpoleEvent: {
    title: string;
    starts_tomorrow?: boolean;
    event_count?: number;
    location?: string;
  } | null;
  activeHolidays: Array<{ title: string; slug: string }>;
  closingSoonExhibitions: Array<{
    title: string;
    venue_name?: string;
    days_remaining: number;
  }>;
  schoolCalendarEvents: Array<{
    event_type: string;
    school_system: string;
    title: string;
  }>;
  weather: { temperature_f: number; condition: string } | null;
  weatherSignal: string | null; // "rain" | "cold" | "nice" | "hot" | null
  todayEventCount: number;
  topCategories: string[];
  timeSlot: string; // "morning" | "midday" | "happy_hour" | "evening" | "late_night"
  dayOfWeek: string; // "monday" | "tuesday" | etc.
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Internal signal result
// ---------------------------------------------------------------------------

interface Signal {
  type: "tentpole" | "holiday" | "exhibition_closing" | "school_calendar" | "weather" | "general_activity";
  headline: string;
  pill?: { label: string; href: string; accent?: string; ariaLabel: string };
}

// ---------------------------------------------------------------------------
// Threshold: collapse if event count is below this AND no other signals fire
// ---------------------------------------------------------------------------
const QUIET_DAY_THRESHOLD = 20;

// ---------------------------------------------------------------------------
// Day label helpers
// ---------------------------------------------------------------------------

const DAY_LABEL_MAP: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function buildDayLabel(dayOfWeek: string, timeSlot: string): string {
  const day = DAY_LABEL_MAP[dayOfWeek] ?? capitalize(dayOfWeek);
  switch (timeSlot) {
    case "morning":
      return `${day} Morning`;
    case "midday":
      return `${day} Afternoon`;
    case "happy_hour":
      return `${day} Happy Hour`;
    case "evening":
      return `${day} Evening`;
    case "late_night":
      return `${day} Late Night`;
    default:
      return day;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert ALL-CAPS strings to Title Case. Leaves mixed-case strings untouched. */
function toTitleCase(str: string): string {
  if (str !== str.toUpperCase()) return str; // Only transform fully uppercase strings
  const minorWords = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "at", "by", "in", "of", "on", "to", "up"]);
  return str
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (i === 0 || !minorWords.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Time-of-day labels for activity clauses
// ---------------------------------------------------------------------------

function slotLabel(timeSlot: string): string {
  switch (timeSlot) {
    case "morning":
      return "this morning";
    case "midday":
      return "this afternoon";
    case "happy_hour":
      return "this evening";
    case "evening":
      return "tonight";
    case "late_night":
      return "tonight";
    default:
      return "today";
  }
}

// ---------------------------------------------------------------------------
// Format top categories for activity prose
// ---------------------------------------------------------------------------

function formatCategories(topCategories: string[]): string {
  if (topCategories.length === 0) return "";
  if (topCategories.length === 1) return topCategories[0];
  if (topCategories.length === 2) return `${topCategories[0]} and ${topCategories[1]}`;
  return `${topCategories.slice(0, 2).join(", ")}, and more`;
}

// ---------------------------------------------------------------------------
// Signal extractors — each returns a Signal or null
// ---------------------------------------------------------------------------

function extractTentpole(ctx: BriefingContext): Signal | null {
  if (!ctx.tentpoleEvent) return null;

  const { title, starts_tomorrow, event_count, location } = ctx.tentpoleEvent;
  const timing = starts_tomorrow ? "starts tomorrow" : "is happening now";

  // Embed event_count in headline when available and no weather to fall back on
  let headline: string;
  if (event_count && !ctx.weather) {
    const locClause = location ? ` across ${location}` : "";
    headline = `${title} ${timing}. ${event_count} events${locClause}.`;
  } else {
    headline = `${title} ${timing}.`;
  }

  return {
    type: "tentpole",
    headline,
    pill: {
      label: `${title} Preview`,
      href: buildExploreUrl({ portalSlug: ctx.portalSlug }),
      accent: "var(--gold)",
      ariaLabel: `See ${title} events`,
    },
  };
}

function extractHoliday(ctx: BriefingContext): Signal | null {
  if (ctx.activeHolidays.length === 0) return null;

  const holiday = ctx.activeHolidays[0];

  // Embed event count inline when available — "Happy Juneteenth — 8 community events today."
  const countClause = ctx.todayEventCount > 0
    ? ` — ${ctx.todayEventCount} ${formatCategories(ctx.topCategories) || "community"} events today.`
    : "!";
  const headline = `Happy ${holiday.title}${countClause}`;

  return {
    type: "holiday",
    headline,
    // No pill — the activity count clause carries the navigation intent
  };
}

function extractExhibitionClosing(ctx: BriefingContext): Signal | null {
  if (ctx.closingSoonExhibitions.length === 0) return null;

  const ex = ctx.closingSoonExhibitions[0];
  const title = toTitleCase(ex.title);
  const venueClause = ex.venue_name ? ` at ${ex.venue_name}` : "";
  const headline = `${title}${venueClause} closes in ${ex.days_remaining} days.`;

  return {
    type: "exhibition_closing",
    headline,
    pill: {
      label: `${title} — closing soon`,
      href: buildExploreUrl({ portalSlug: ctx.portalSlug, lane: "arts" }),
      accent: "var(--copper)",
      ariaLabel: `See ${title} exhibition`,
    },
  };
}

function extractSchoolCalendar(ctx: BriefingContext): Signal | null {
  if (ctx.schoolCalendarEvents.length === 0) return null;

  const ev = ctx.schoolCalendarEvents[0];
  const headline = `No school tomorrow (${ev.school_system} ${ev.title}).`;

  return {
    type: "school_calendar",
    headline,
    pill: {
      label: "Kid-friendly events",
      href: buildExploreUrl({
        portalSlug: ctx.portalSlug,
        lane: "events",
        categories: "family",
      }),
      accent: "var(--neon-green)",
      ariaLabel: "See family-friendly events",
    },
  };
}

function extractWeather(ctx: BriefingContext): Signal | null {
  if (!ctx.weather || !ctx.weatherSignal) return null;

  const temp = Math.round(ctx.weather.temperature_f);
  const signal = ctx.weatherSignal;

  let headline: string;
  switch (signal) {
    case "rain":
      headline = `Rainy ${slotLabel(ctx.timeSlot)} — ${ctx.todayEventCount} events indoors.`;
      break;
    case "cold":
      headline = `Cold out at ${temp}°. Warm up indoors tonight.`;
      break;
    case "hot":
      headline = `${temp}° and hot. Plenty of air-conditioned options.`;
      break;
    case "nice":
      headline = `Sunny and ${temp}°. Great afternoon to get out.`;
      break;
    default:
      headline = `${temp}° ${ctx.weather.condition} ${slotLabel(ctx.timeSlot)}.`;
  }

  return {
    type: "weather",
    headline,
  };
}

function extractActivity(ctx: BriefingContext): Signal | null {
  if (ctx.todayEventCount < QUIET_DAY_THRESHOLD) return null;

  const cats = formatCategories(ctx.topCategories);
  const catClause = cats ? ` ${cats} and more` : "";
  const headline = `${ctx.todayEventCount}${catClause} events happening in Atlanta today.`;

  return {
    type: "general_activity",
    headline,
  };
}

// ---------------------------------------------------------------------------
// Supporting clause builders (second signal in the chain)
// ---------------------------------------------------------------------------

function buildActivitySupporting(ctx: BriefingContext): string | null {
  if (ctx.todayEventCount < QUIET_DAY_THRESHOLD) return null;
  const cats = formatCategories(ctx.topCategories);
  if (cats) {
    return `${ctx.todayEventCount} ${cats} events ${slotLabel(ctx.timeSlot)}.`;
  }
  return `${ctx.todayEventCount} events ${slotLabel(ctx.timeSlot)}.`;
}

function buildWeatherSupporting(ctx: BriefingContext): string | null {
  if (!ctx.weather) return null;
  const temp = Math.round(ctx.weather.temperature_f);
  const signal = ctx.weatherSignal;

  if (signal === "nice") {
    const loc = ctx.tentpoleEvent?.location ?? "Atlanta";
    return `${temp}° and clear ${slotLabel(ctx.timeSlot)} in ${loc}.`;
  }
  if (signal === "rain") {
    return `${temp}° with rain — good night for indoor shows.`;
  }
  return `${temp}° ${ctx.weather.condition} ${slotLabel(ctx.timeSlot)}.`;
}

// ---------------------------------------------------------------------------
// Compose supporting clause based on what the primary signal was
// ---------------------------------------------------------------------------

function buildSupportingClause(primaryType: Signal["type"], ctx: BriefingContext): string | null {
  switch (primaryType) {
    case "tentpole":
      // Second preference: weather, then activity count
      if (ctx.weather && ctx.weatherSignal) return buildWeatherSupporting(ctx);
      return buildActivitySupporting(ctx);

    case "holiday":
      // Activity count is already embedded in the holiday headline
      return null;

    case "exhibition_closing":
      if (ctx.weather && ctx.weatherSignal) return buildWeatherSupporting(ctx);
      return buildActivitySupporting(ctx);

    case "school_calendar":
      return buildActivitySupporting(ctx);

    case "weather":
      return null; // weather clause already embedded in the headline

    case "general_activity":
      return null; // standalone, no secondary needed

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main compose function
// ---------------------------------------------------------------------------

export function composeBriefing(ctx: BriefingContext): BriefingOutput {
  const dayLabel = buildDayLabel(ctx.dayOfWeek, ctx.timeSlot);

  const weatherBadge = ctx.weather
    ? {
        temp: `${Math.round(ctx.weather.temperature_f)}°`,
        condition: ctx.weather.condition,
      }
    : undefined;

  // Walk the priority chain
  const primarySignal =
    extractTentpole(ctx) ??
    extractHoliday(ctx) ??
    extractExhibitionClosing(ctx) ??
    extractSchoolCalendar(ctx) ??
    extractWeather(ctx) ??
    extractActivity(ctx);

  // Quiet-day collapse: no signal fired at all
  if (!primarySignal) {
    return {
      prose: "",
      collapsed: true,
      pills: [],
      dayLabel,
      weatherBadge,
    };
  }

  // Build supporting clause
  const supportingClause = buildSupportingClause(primarySignal.type, ctx);

  const prose = supportingClause
    ? `${primarySignal.headline} ${supportingClause}`
    : primarySignal.headline;

  // Collect pills from all fired signals (primary may have one, secondary signals add theirs)
  const pills: BriefingOutput["pills"] = [];

  if (primarySignal.pill) {
    pills.push(primarySignal.pill);
  }

  // Also emit pills for secondary signals that fired in the support role
  // (exhibition closing and school calendar always get pills when present)
  if (primarySignal.type !== "exhibition_closing" && ctx.closingSoonExhibitions.length > 0) {
    const exSignal = extractExhibitionClosing(ctx);
    if (exSignal?.pill) pills.push(exSignal.pill);
  }
  if (primarySignal.type !== "school_calendar" && ctx.schoolCalendarEvents.length > 0) {
    const schoolSignal = extractSchoolCalendar(ctx);
    if (schoolSignal?.pill) pills.push(schoolSignal.pill);
  }

  return {
    prose,
    collapsed: false,
    pills,
    dayLabel,
    weatherBadge,
  };
}
