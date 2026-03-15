/**
 * Venue specials: status computation and active-special filtering.
 *
 * Extracted from the city-pulse route so it can be unit-tested independently
 * and reused if a dedicated specials endpoint is added later.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpecialRow = {
  id: number;
  venue_id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
};

export type SpecialStatus = {
  state: "active_now" | "starting_soon" | "inactive";
  startsInMinutes: number | null;
  remainingMinutes: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTimeMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getCurrentISOWeekday(now: Date): number {
  const jsDay = now.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

// ---------------------------------------------------------------------------
// Core: compute the live status of a single special
// ---------------------------------------------------------------------------

/**
 * Compute whether a venue special is active now, starting soon, or inactive.
 * Used to filter `venue_specials` rows before inserting them into the feed.
 */
export function getSpecialStatus(
  special: SpecialRow,
  now: Date,
  today: string,
): SpecialStatus {
  // Date eligibility
  if (special.start_date && special.start_date > today) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }
  if (special.end_date && special.end_date < today) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  const currentIsoDay = getCurrentISOWeekday(now);
  if (special.days_of_week?.length && !special.days_of_week.includes(currentIsoDay)) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  // Guard: if days_of_week is NULL, infer from title keywords
  // Prevents "Sunday Brunch" showing active on Monday, etc.
  if (!special.days_of_week?.length) {
    const titleLower = special.title.toLowerCase();
    const DAY_KEYWORDS: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7,
    };
    for (const [dayName, isoDay] of Object.entries(DAY_KEYWORDS)) {
      if (titleLower.includes(dayName) && currentIsoDay !== isoDay) {
        return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
      }
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = getTimeMinutes(special.time_start);
  const end = getTimeMinutes(special.time_end);
  const upcomingWindow = 120; // 2 hours

  if (start === null && end === null) {
    return { state: "active_now", startsInMinutes: null, remainingMinutes: null };
  }

  if (start !== null && end !== null) {
    // Overnight (e.g. 10pm–2am)
    if (start > end) {
      if (currentMinutes >= start || currentMinutes <= end) {
        const remaining = currentMinutes <= end
          ? end - currentMinutes
          : (1440 - currentMinutes) + end;
        return { state: "active_now", startsInMinutes: 0, remainingMinutes: remaining };
      }
      const startsIn = start - currentMinutes;
      if (startsIn >= 0 && startsIn <= upcomingWindow) {
        return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      }
      return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
    }

    if (currentMinutes >= start && currentMinutes <= end) {
      return { state: "active_now", startsInMinutes: 0, remainingMinutes: end - currentMinutes };
    }
    if (currentMinutes < start) {
      const startsIn = start - currentMinutes;
      if (startsIn <= upcomingWindow) {
        return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      }
    }
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  if (start !== null) {
    if (currentMinutes >= start) {
      return { state: "active_now", startsInMinutes: 0, remainingMinutes: null };
    }
    const startsIn = start - currentMinutes;
    if (startsIn <= upcomingWindow) {
      return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
    }
  }

  if (end !== null && currentMinutes <= end) {
    return { state: "active_now", startsInMinutes: null, remainingMinutes: end - currentMinutes };
  }

  return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
}
