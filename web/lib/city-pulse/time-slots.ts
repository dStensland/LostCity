/**
 * Time slot classification for the City Pulse feed.
 *
 * Time slots drive contextual section selection — "Right Now" shows
 * different content during morning vs late night. The feed refreshes
 * when the user crosses a slot boundary.
 */

import type { TimeSlot } from "./types";

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
 * Calculate milliseconds until the next time slot boundary.
 */
export function msUntilNextSlot(now: Date = new Date()): number {
  const nextHour = getNextSlotBoundaryHour(now.getHours());
  const next = new Date(now);
  next.setMinutes(0, 0, 0);

  if (nextHour <= now.getHours()) {
    // Wraps to next day (e.g., late_night -> morning at 5am)
    next.setDate(next.getDate() + 1);
  }
  next.setHours(nextHour);

  return Math.max(0, next.getTime() - now.getTime());
}

/**
 * Get the day of the week as a lowercase string.
 *
 * Late-night continuity: if it's between midnight and 5am, people still
 * think of it as the previous night. "Sunday night" doesn't end at midnight.
 * So we return the previous day's name during those hours.
 */
export function getDayOfWeek(date: Date = new Date()): string {
  const effective = new Date(date);
  if (effective.getHours() < 5) {
    effective.setDate(effective.getDate() - 1);
  }
  return effective
    .toLocaleDateString("en-US", { weekday: "long" })
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
