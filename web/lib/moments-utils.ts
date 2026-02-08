/**
 * Client-safe types and utilities for festival moments.
 * These can be used in both client and server components.
 * Data-fetching / computation lives in lib/moments.ts (server-only).
 */

import type { Festival } from "@/lib/festivals";

export type CountdownUrgency =
  | "happening-now"
  | "starts-tomorrow"
  | "days-away"
  | "next-week"
  | "weeks-away"
  | "month-label"
  | "tbd";

export interface CountdownLabel {
  urgency: CountdownUrgency;
  text: string;
  daysUntil: number | null;
}

export type FestivalTier = 1 | 2 | 3;

export interface FestivalMoment {
  festival: Festival;
  tier: FestivalTier;
  countdown: CountdownLabel;
  isLive: boolean;
}

export type TimeOfDay = "morning" | "afternoon" | "evening" | "latenight";
export type Season = "spring" | "summer" | "fall" | "winter";

export interface TimeContext {
  timeOfDay: TimeOfDay;
  season: Season;
  isWeekend: boolean;
  sectionLabel: string | null;
  sectionCategories: string[];
}

export interface MomentsResponse {
  takeover: FestivalMoment | null;
  imminent: FestivalMoment[];
  upcoming: FestivalMoment[];
  saveTheDate: { month: string; festivals: FestivalMoment[] }[];
  timeContext: TimeContext;
}

/** Map countdown urgency to a CSS color variable */
export function getUrgencyColor(urgency: CountdownUrgency): string {
  switch (urgency) {
    case "happening-now":
    case "starts-tomorrow":
      return "var(--neon-red)";
    case "days-away":
    case "next-week":
      return "var(--neon-amber)";
    case "weeks-away":
      return "var(--neon-cyan)";
    case "month-label":
    case "tbd":
      return "var(--muted)";
  }
}

/** Map a festival category to an accent color */
export function getCategoryAccentColor(category: string | null | undefined): string {
  if (!category) return "var(--neon-magenta)";
  const colors: Record<string, string> = {
    music: "var(--neon-magenta)",
    film: "var(--neon-cyan)",
    theater: "var(--coral)",
    art: "var(--gold)",
    community: "var(--neon-green)",
    food_drink: "var(--coral)",
    words: "var(--neon-cyan)",
    learning: "var(--gold)",
    comedy: "var(--neon-amber)",
  };
  return colors[category] || "var(--neon-magenta)";
}

/** Compute countdown label for a festival relative to today */
export function computeCountdown(
  festival: Festival,
  today: string
): CountdownLabel {
  const start = festival.announced_start;
  const end = festival.announced_end;

  // No dates at all — fall back to typical_month or TBD
  if (!start) {
    if (festival.typical_month) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const name = monthNames[festival.typical_month - 1];
      if (name) {
        return { urgency: "month-label", text: name, daysUntil: null };
      }
    }
    return { urgency: "tbd", text: "TBD", daysUntil: null };
  }

  const todayMs = new Date(today + "T00:00:00").getTime();
  const startMs = new Date(start + "T00:00:00").getTime();
  const endMs = end
    ? new Date(end + "T00:00:00").getTime()
    : startMs;

  // Currently live
  if (todayMs >= startMs && todayMs <= endMs) {
    return { urgency: "happening-now", text: "Happening Now", daysUntil: 0 };
  }

  // Already past
  if (todayMs > endMs) {
    return { urgency: "tbd", text: "Past", daysUntil: null };
  }

  const daysUntil = Math.ceil((startMs - todayMs) / (1000 * 60 * 60 * 24));

  if (daysUntil === 1) {
    return { urgency: "starts-tomorrow", text: "Starts Tomorrow", daysUntil: 1 };
  }
  if (daysUntil <= 6) {
    return { urgency: "days-away", text: `In ${daysUntil} Days`, daysUntil };
  }
  if (daysUntil <= 13) {
    return { urgency: "next-week", text: "Next Week", daysUntil };
  }
  if (daysUntil <= 56) {
    const weeks = Math.round(daysUntil / 7);
    return {
      urgency: "weeks-away",
      text: weeks === 1 ? "In 1 Week" : `In ${weeks} Weeks`,
      daysUntil,
    };
  }

  // 57+ days: show month label
  const startDate = new Date(start + "T00:00:00");
  const monthLabel = startDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return { urgency: "month-label", text: monthLabel, daysUntil };
}

/** Format a date range for display: "Mar 15-17" or "Mar 15 - Apr 2" */
export function formatFestivalDates(
  start: string | null,
  end: string | null
): string | null {
  if (!start) return null;
  const s = new Date(start + "T00:00:00");
  const startLabel = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (!end || end === start) return startLabel;

  const e = new Date(end + "T00:00:00");
  if (s.getMonth() === e.getMonth()) {
    return `${startLabel}-${e.getDate()}`;
  }
  const endLabel = e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}
