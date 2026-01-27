/**
 * Hours utility functions for checking spot open/close times
 */

export type HoursData = Record<string, { open: string; close: string } | null>;

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Parse a time string (HH:MM) into minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}


/**
 * Get the day name for a given date
 */
function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/**
 * Check if a spot is open at a given date/time
 * Returns open status and close time if open
 */
export function isOpenAt(
  hours: HoursData | null,
  date: Date,
  is24Hours?: boolean
): { isOpen: boolean; closesAt?: string } {
  if (is24Hours) return { isOpen: true };
  if (!hours) return { isOpen: false };

  const day = getDayName(date);
  const currentTime = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  const currentMinutes = timeToMinutes(currentTime);

  const todayHours = hours[day];
  if (!todayHours) {
    // Check if still open from previous day (overnight hours)
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayName = getDayName(yesterday);
    const yesterdayHours = hours[yesterdayName];

    if (yesterdayHours) {
      const { open, close } = yesterdayHours;
      const openMins = timeToMinutes(open);
      const closeMins = timeToMinutes(close);

      // Check for overnight (close < open means next day)
      if (closeMins < openMins && currentMinutes < closeMins) {
        return { isOpen: true, closesAt: close };
      }
    }
    return { isOpen: false };
  }

  const { open, close } = todayHours;
  const openMins = timeToMinutes(open);
  const closeMins = timeToMinutes(close);

  // Handle overnight hours (e.g., open 18:00, close 02:00)
  if (closeMins < openMins) {
    // After opening time today or before closing time (from yesterday)
    if (currentMinutes >= openMins || currentMinutes < closeMins) {
      return { isOpen: true, closesAt: close };
    }
  } else {
    // Normal hours
    if (currentMinutes >= openMins && currentMinutes < closeMins) {
      return { isOpen: true, closesAt: close };
    }
  }

  return { isOpen: false };
}

/**
 * Get the close time for a spot on a given date
 * Returns null if closed that day
 */
export function getCloseTime(hours: HoursData | null, date: Date): string | null {
  if (!hours) return null;

  const day = getDayName(date);
  const todayHours = hours[day];

  if (!todayHours) return null;
  return todayHours.close;
}

/**
 * Get the open time for a spot on a given date
 * Returns null if closed that day
 */
export function getOpenTime(hours: HoursData | null, date: Date): string | null {
  if (!hours) return null;

  const day = getDayName(date);
  const todayHours = hours[day];

  if (!todayHours) return null;
  return todayHours.open;
}

/**
 * Check if a spot's close time is within a certain range of an event's time
 * Used to determine if we should show "til Xam" on spot cards
 *
 * @param closeTime - The spot's close time (HH:MM)
 * @param eventStart - The event's start time (HH:MM)
 * @param eventEnd - The event's end time (HH:MM) or null
 * @param rangeHours - Number of hours before/after event to consider "relevant"
 */
export function isCloseTimeRelevant(
  closeTime: string,
  eventStart: string,
  eventEnd: string | null,
  rangeHours: number = 3
): boolean {
  const closeMins = timeToMinutes(closeTime);
  const startMins = timeToMinutes(eventStart);
  const endMins = eventEnd ? timeToMinutes(eventEnd) : startMins + 180; // Default 3 hour event

  // Handle overnight close times (e.g., 02:00 means 26:00 / 1560 minutes)
  const adjustedCloseMins = closeMins < 12 * 60 ? closeMins + 24 * 60 : closeMins;
  const adjustedEndMins = endMins < startMins ? endMins + 24 * 60 : endMins;

  // Check if close time is within range of event end
  const rangeMinutes = rangeHours * 60;
  const lowerBound = adjustedEndMins - rangeMinutes;
  const upperBound = adjustedEndMins + rangeMinutes;

  return adjustedCloseMins >= lowerBound && adjustedCloseMins <= upperBound;
}

/**
 * Format a time string (HH:MM) to a friendly display format
 * e.g., "02:00" -> "2am", "14:30" -> "2:30pm"
 */
export function formatCloseTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const adjustedHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

  // Handle overnight times (close time < 6am is next day)
  const isOvernight = hours < 6;
  const displayPeriod = isOvernight ? "am" : hours >= 12 ? "pm" : "am";

  if (minutes === 0) {
    return `${adjustedHours}${displayPeriod}`;
  }
  return `${adjustedHours}:${minutes.toString().padStart(2, "0")}${displayPeriod}`;
}

/**
 * Check if two time ranges overlap
 * Used for finding events that overlap with the main event ±2 hours
 *
 * @param start1 - First event start time (HH:MM)
 * @param end1 - First event end time (HH:MM) or null
 * @param start2 - Second event start time (HH:MM)
 * @param end2 - Second event end time (HH:MM) or null
 * @param bufferHours - Hours of buffer to add (for ±2 hour overlap)
 */
export function doTimeRangesOverlap(
  start1: string,
  end1: string | null,
  start2: string,
  end2: string | null,
  bufferHours: number = 2
): boolean {
  const defaultDuration = 180; // 3 hours in minutes
  const bufferMins = bufferHours * 60;

  const start1Mins = timeToMinutes(start1) - bufferMins;
  let end1Mins = end1 ? timeToMinutes(end1) + bufferMins : timeToMinutes(start1) + defaultDuration + bufferMins;
  const start2Mins = timeToMinutes(start2);
  let end2Mins = end2 ? timeToMinutes(end2) : timeToMinutes(start2) + defaultDuration;

  // Handle overnight events
  if (end1Mins < start1Mins) end1Mins += 24 * 60;
  if (end2Mins < start2Mins) end2Mins += 24 * 60;

  // Check for overlap
  return start1Mins < end2Mins && start2Mins < end1Mins;
}

/**
 * Check if a spot will be open during an event
 * Considers if spot is open before event starts and will still be open during
 */
export function isSpotOpenDuringEvent(
  hours: HoursData | null,
  eventDate: Date,
  eventStart: string,
  eventEnd: string | null,
  is24Hours?: boolean
): { isRelevant: boolean; closesAt?: string } {
  if (is24Hours) return { isRelevant: true };
  if (!hours) return { isRelevant: false };

  const day = getDayName(eventDate);
  const todayHours = hours[day];

  if (!todayHours) return { isRelevant: false };

  const { open, close } = todayHours;
  const openMins = timeToMinutes(open);
  let closeMins = timeToMinutes(close);
  const eventStartMins = timeToMinutes(eventStart);
  const eventEndMins = eventEnd
    ? timeToMinutes(eventEnd)
    : eventStartMins + 180; // Default 3 hour event

  // Handle overnight close times
  if (closeMins < openMins) {
    closeMins += 24 * 60;
  }

  // Spot is relevant if it's open before the event ends
  // and closes within 3 hours after the event ends
  const isOpenDuringEvent = openMins <= eventStartMins && closeMins > eventStartMins;

  if (isOpenDuringEvent || closeMins > eventEndMins) {
    return {
      isRelevant: true,
      closesAt: isCloseTimeRelevant(close, eventStart, eventEnd, 3) ? close : undefined,
    };
  }

  return { isRelevant: false };
}
