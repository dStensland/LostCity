/**
 * Time slot classification for the City Pulse feed.
 *
 * Time slots drive contextual section selection — "Right Now" shows
 * different content during morning vs late night. The feed refreshes
 * when the user crosses a slot boundary.
 *
 * IMPORTANT: All time calculations use America/New_York explicitly.
 * The feed's sense of time is always Atlanta time, regardless of
 * where the server (Vercel = UTC) or client browser is located.
 */

import type { TimeSlot } from "./types";

// ── Portal timezone — single source of truth ─────────────────────────────────

const PORTAL_TZ = "America/New_York";

/**
 * Get the current hour (0-23) in Atlanta time.
 * Works correctly on both server (UTC/Vercel) and client (any timezone).
 */
export function getPortalHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PORTAL_TZ,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
}

/**
 * Get the current date string (YYYY-MM-DD) in Atlanta time.
 */
export function getPortalDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PORTAL_TZ }).format(now);
}

/** Time slot boundaries (inclusive start hour) */
const SLOT_BOUNDARIES: { slot: TimeSlot; startHour: number }[] = [
  { slot: "morning", startHour: 5 },
  { slot: "midday", startHour: 11 },
  { slot: "happy_hour", startHour: 15 },
  { slot: "evening", startHour: 18 },
  { slot: "late_night", startHour: 22 },
];

/**
 * Classify the current hour into a time slot.
 * Handles the late_night wrap: 22:00–4:59.
 */
export function getTimeSlot(hour: number): TimeSlot {
  // Normalize to 0-23
  const h = ((hour % 24) + 24) % 24;

  if (h >= 22 || h < 5) return "late_night";
  if (h >= 18) return "evening";
  if (h >= 15) return "happy_hour";
  if (h >= 11) return "midday";
  return "morning";
}

/**
 * Get a human-readable label for a time slot.
 */
export function getTimeSlotLabel(slot: TimeSlot): string {
  switch (slot) {
    case "morning":
      return "This Morning";
    case "midday":
      return "This Afternoon";
    case "happy_hour":
      return "Happy Hour";
    case "evening":
      return "Tonight";
    case "late_night":
      return "Late Night";
  }
}

/**
 * Get the hour when the current time slot ends (the start of the next slot).
 * Useful for scheduling feed refreshes at slot boundaries.
 */
export function getNextSlotBoundaryHour(currentHour: number): number {
  const currentSlot = getTimeSlot(currentHour);
  const currentIdx = SLOT_BOUNDARIES.findIndex((b) => b.slot === currentSlot);
  const nextIdx = (currentIdx + 1) % SLOT_BOUNDARIES.length;
  return SLOT_BOUNDARIES[nextIdx].startHour;
}

/**
 * Calculate milliseconds until the next time slot boundary (Atlanta time).
 */
export function msUntilNextSlot(now: Date = new Date()): number {
  const currentHour = getPortalHour(now);
  const nextHour = getNextSlotBoundaryHour(currentHour);

  // Compute minutes/seconds into the current hour (portal-tz aware)
  const portalMinute = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PORTAL_TZ,
      minute: "numeric",
    }).format(now),
  );
  const portalSecond = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PORTAL_TZ,
      second: "numeric",
    }).format(now),
  );

  // Hours until next boundary
  let hoursUntil = nextHour - currentHour;
  if (hoursUntil <= 0) hoursUntil += 24; // wraps to next day

  const msUntil =
    hoursUntil * 3_600_000 -
    portalMinute * 60_000 -
    portalSecond * 1_000;

  return Math.max(0, msUntil);
}

/**
 * Get the day of the week as a lowercase string in Atlanta time.
 *
 * Late-night continuity: if it's between midnight and 5am, people still
 * think of it as the previous night. "Sunday night" doesn't end at midnight.
 * So we return the previous day's name during those hours.
 */
export function getDayOfWeek(date: Date = new Date()): string {
  const portalHour = getPortalHour(date);

  if (portalHour < 5) {
    // Roll back one day — "late night Sunday" is still Sunday
    const prev = new Date(date.getTime() - 86_400_000);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: PORTAL_TZ,
      weekday: "long",
    })
      .format(prev)
      .toLowerCase();
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_TZ,
    weekday: "long",
  })
    .format(date)
    .toLowerCase();
}

/**
 * Check if a given date falls on a weekend (Friday–Sunday).
 * Friday is included because the feed's "This Weekend" section
 * starts on Friday.
 */
export function isWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6; // Sun, Fri, Sat
}

/**
 * Check if the current time slot is appropriate for nightlife content.
 * Used by the Right Now section to include club/bar content.
 */
export function isNightlifeTime(slot: TimeSlot): boolean {
  return slot === "evening" || slot === "late_night" || slot === "happy_hour";
}

/**
 * Day-of-week theme — drives editorial headlines and themed quick links.
 * Pure function, safe for client-side use.
 */
export function getDayTheme(dayOfWeek: string, timeSlot: TimeSlot): string | undefined {
  switch (dayOfWeek) {
    case "tuesday":
      return "taco_tuesday";
    case "wednesday":
      return "wine_wednesday";
    case "thursday":
      return "thirsty_thursday";
    case "friday":
      return "friday_night";
    case "saturday":
      return timeSlot === "morning" || timeSlot === "midday"
        ? "brunch_weekend"
        : "saturday_night";
    case "sunday":
      return timeSlot === "morning" || timeSlot === "midday"
        ? "brunch_weekend"
        : "sunday_funday";
    default:
      return undefined;
  }
}
