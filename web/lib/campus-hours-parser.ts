/**
 * Campus hours parser — parses freeform openHours strings from hospital profiles
 * into structured data for time-of-day awareness, discharge bundles, and staff boards.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type ParsedCampusHours = {
  kind: "structured" | "always" | "badge_access" | "on_call" | "unknown";
  is24x7: boolean;
  requiresBadge: boolean;
  schedule: Record<DayKey, { open: string; close: string }> | null;
  raw: string;
};

export type CampusOpenStatus = {
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
  statusLabel: "Open Now" | "Closed" | "24/7" | "Badge Access" | "On-Call" | "See Schedule";
  isLateNight: boolean;
};

export type Season = "spring" | "summer" | "fall" | "winter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_DAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND: DayKey[] = ["sat", "sun"];

const DAY_MAP: Record<string, DayKey> = {
  sun: "sun", sunday: "sun",
  mon: "mon", monday: "mon",
  tue: "tue", tuesday: "tue", tues: "tue",
  wed: "wed", wednesday: "wed",
  thu: "thu", thursday: "thu", thurs: "thu",
  fri: "fri", friday: "fri",
  sat: "sat", saturday: "sat",
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseTimeToken(token: string): string | null {
  const cleaned = token.trim().toLowerCase().replace(/\./g, "");
  if (cleaned === "midnight") return "00:00";
  if (cleaned === "noon") return "12:00";
  if (cleaned === "dawn") return "06:00";
  if (cleaned === "dusk") return "20:00";

  // Match patterns like "8", "8:30", "8am", "8:30pm", "8 am", "8:30 pm"
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (hours > 23 || minutes > 59) return null;

  if (period) {
    const isPM = period.startsWith("p");
    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function expandDayRange(rangeStr: string): DayKey[] {
  const cleaned = rangeStr.trim().toLowerCase();

  if (cleaned === "daily" || cleaned === "everyday" || cleaned === "every day") {
    return [...ALL_DAYS];
  }
  if (cleaned === "weekdays" || cleaned === "weekday") return [...WEEKDAYS];
  if (cleaned === "weekends" || cleaned === "weekend") return [...WEEKEND];

  // Handle "Mon-Fri", "Sat-Sun"
  const rangeParts = cleaned.split("-").map((s) => s.trim());
  if (rangeParts.length === 2) {
    const startDay = DAY_MAP[rangeParts[0]];
    const endDay = DAY_MAP[rangeParts[1]];
    if (startDay && endDay) {
      const startIdx = ALL_DAYS.indexOf(startDay);
      const endIdx = ALL_DAYS.indexOf(endDay);
      const days: DayKey[] = [];
      if (startIdx <= endIdx) {
        for (let i = startIdx; i <= endIdx; i++) days.push(ALL_DAYS[i]);
      } else {
        // Wrap around (e.g., Fri-Mon)
        for (let i = startIdx; i < ALL_DAYS.length; i++) days.push(ALL_DAYS[i]);
        for (let i = 0; i <= endIdx; i++) days.push(ALL_DAYS[i]);
      }
      return days;
    }
  }

  // Single day
  const singleDay = DAY_MAP[cleaned];
  if (singleDay) return [singleDay];

  return [];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

export function parseCampusOpenHours(raw: string): ParsedCampusHours {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Always available / 24/7
  if (/^(always\s+available|24\s*\/\s*7)$/i.test(trimmed) || lower === "24/7") {
    return { kind: "always", is24x7: true, requiresBadge: false, schedule: null, raw: trimmed };
  }

  // 24/7 badge access
  if (/24\s*\/\s*7\s+badge\s+access/i.test(trimmed) || /badge\s+access/i.test(trimmed)) {
    return { kind: "badge_access", is24x7: true, requiresBadge: true, schedule: null, raw: trimmed };
  }

  // On-call patterns
  if (/on[- ]?call/i.test(lower) && !/\d/.test(trimmed)) {
    return { kind: "on_call", is24x7: false, requiresBadge: false, schedule: null, raw: trimmed };
  }
  if (/24\s*\/\s*7\s+on[- ]?call/i.test(lower) || /daily.*24\s*\/\s*7\s+on[- ]?call/i.test(lower)) {
    return { kind: "on_call", is24x7: true, requiresBadge: false, schedule: null, raw: trimmed };
  }

  // See schedule / Hours vary
  if (/^(see\s+schedule|hours\s+vary|varies|contact)/i.test(trimmed)) {
    return { kind: "unknown", is24x7: false, requiresBadge: false, schedule: null, raw: trimmed };
  }

  // Try to parse structured hours
  // Handle "Mon-Fri X-Y, Sat-Sun X-Y" or "Mon-Fri X, Sat-Sun Y" or "Daily X-Y"
  // Also handle "Mon-Fri 8 AM-5 PM" etc.
  const schedule: Record<DayKey, { open: string; close: string }> = {} as Record<DayKey, { open: string; close: string }>;

  // Split on comma or semicolon for multi-segment
  // But also handle "Garden: dawn to dusk. Lounge: 24/7" — multiple segments with labels
  const segments = trimmed.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  let anyParsed = false;

  for (const segment of segments) {
    // Strip labels like "Garden:" prefix
    const unlabeled = segment.replace(/^[A-Za-z\s]+:\s*/, "");

    // Try "DayRange TimeOpen-TimeClose" pattern
    // e.g., "Mon-Fri 8 AM-7 PM", "Daily 6:30 AM-8 PM", "Sat-Sun 10 AM-5 PM"
    const dayTimeMatch = unlabeled.match(
      /^([\w\-\s]+?)\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a|p)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a|p)?|midnight|noon|dawn|dusk)$/i
    );

    if (dayTimeMatch) {
      const days = expandDayRange(dayTimeMatch[1]);
      const openTime = parseTimeToken(dayTimeMatch[2]);
      const closeTime = parseTimeToken(dayTimeMatch[3]);

      if (days.length > 0 && openTime && closeTime) {
        for (const day of days) {
          schedule[day] = { open: openTime, close: closeTime };
        }
        anyParsed = true;
        continue;
      }
    }

    // Try "DayRange, TimeOpen-TimeClose" already split by comma — won't have comma
    // Try standalone "TimeOpen-TimeClose" (for "Daily" segments already parsed, or "24/7" sub-parts)
    const timeOnlyMatch = unlabeled.match(
      /^(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a|p)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a|p)?|midnight|noon|dawn|dusk)$/i
    );
    if (timeOnlyMatch) {
      const openTime = parseTimeToken(timeOnlyMatch[1]);
      const closeTime = parseTimeToken(timeOnlyMatch[2]);
      if (openTime && closeTime) {
        // Apply to all days not yet set
        for (const day of ALL_DAYS) {
          if (!schedule[day]) {
            schedule[day] = { open: openTime, close: closeTime };
          }
        }
        anyParsed = true;
        continue;
      }
    }

    // Handle "24/7" in a sub-segment
    if (/24\s*\/\s*7/i.test(unlabeled)) {
      // Don't set schedule, just mark overall as having 24/7 components
      anyParsed = true;
      continue;
    }

    // Handle "on-call weekends" or "Mon-Fri, on-call weekends"
    if (/on[- ]?call/i.test(unlabeled)) {
      anyParsed = true;
      continue;
    }
  }

  if (anyParsed) {
    const hasSchedule = ALL_DAYS.some((d) => schedule[d]);
    const allDaysSet = ALL_DAYS.every((d) => schedule[d]);
    const is24x7 = allDaysSet && ALL_DAYS.every((d) => {
      const h = schedule[d];
      return h && h.open === "00:00" && h.close === "00:00";
    });

    return {
      kind: hasSchedule ? "structured" : "always",
      is24x7,
      requiresBadge: false,
      schedule: hasSchedule ? schedule : null,
      raw: trimmed,
    };
  }

  return { kind: "unknown", is24x7: false, requiresBadge: false, schedule: null, raw: trimmed };
}

// ---------------------------------------------------------------------------
// Open status checker
// ---------------------------------------------------------------------------

export function getCampusResourceOpenStatus(parsed: ParsedCampusHours, now?: Date): CampusOpenStatus {
  const date = now || new Date();

  if (parsed.kind === "always") {
    return { isOpen: true, closesAt: null, opensAt: null, statusLabel: "24/7", isLateNight: true };
  }

  if (parsed.kind === "badge_access") {
    return { isOpen: true, closesAt: null, opensAt: null, statusLabel: "Badge Access", isLateNight: true };
  }

  if (parsed.kind === "on_call") {
    return { isOpen: true, closesAt: null, opensAt: null, statusLabel: "On-Call", isLateNight: parsed.is24x7 };
  }

  if (parsed.kind === "unknown" || !parsed.schedule) {
    return { isOpen: false, closesAt: null, opensAt: null, statusLabel: "See Schedule", isLateNight: false };
  }

  const dayKey = getDayOfWeekKey(date);
  const currentTime = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  const currentMinutes = timeToMinutes(currentTime);

  const todayHours = parsed.schedule[dayKey];

  // Check if we're currently in an overnight window from yesterday
  const yesterdayIdx = (ALL_DAYS.indexOf(dayKey) - 1 + 7) % 7;
  const yesterdayKey = ALL_DAYS[yesterdayIdx];
  const yesterdayHours = parsed.schedule[yesterdayKey];

  if (yesterdayHours) {
    const yOpen = timeToMinutes(yesterdayHours.open);
    const yClose = timeToMinutes(yesterdayHours.close);
    if (yClose < yOpen && currentMinutes < yClose) {
      // We're in yesterday's overnight window
      return {
        isOpen: true,
        closesAt: yesterdayHours.close,
        opensAt: todayHours?.open || null,
        statusLabel: "Open Now",
        isLateNight: true,
      };
    }
  }

  if (!todayHours) {
    // Find next opening day
    const nextOpen = findNextOpenTime(parsed.schedule, dayKey);
    return { isOpen: false, closesAt: null, opensAt: nextOpen, statusLabel: "Closed", isLateNight: false };
  }

  const openMins = timeToMinutes(todayHours.open);
  const closeMins = timeToMinutes(todayHours.close);

  // Overnight hours (close < open, e.g. 6 AM - 2 AM)
  if (closeMins < openMins) {
    if (currentMinutes >= openMins || currentMinutes < closeMins) {
      return {
        isOpen: true,
        closesAt: todayHours.close,
        opensAt: null,
        statusLabel: "Open Now",
        isLateNight: true,
      };
    }
  } else {
    // Normal hours
    if (currentMinutes >= openMins && currentMinutes < closeMins) {
      const isLate = closeMins >= timeToMinutes("22:00") || closeMins <= timeToMinutes("06:00");
      return {
        isOpen: true,
        closesAt: todayHours.close,
        opensAt: null,
        statusLabel: "Open Now",
        isLateNight: isLate,
      };
    }
  }

  // Currently closed
  const opensAt = currentMinutes < openMins ? todayHours.open : findNextOpenTime(parsed.schedule, dayKey);
  return { isOpen: false, closesAt: null, opensAt, statusLabel: "Closed", isLateNight: false };
}

function findNextOpenTime(schedule: Record<DayKey, { open: string; close: string }>, currentDay: DayKey): string | null {
  const startIdx = ALL_DAYS.indexOf(currentDay);
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = ALL_DAYS[(startIdx + offset) % 7];
    if (schedule[nextDay]) return schedule[nextDay].open;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Late night check
// ---------------------------------------------------------------------------

export function isLateNightResource(parsed: ParsedCampusHours): boolean {
  if (parsed.is24x7 || parsed.requiresBadge || parsed.kind === "always" || parsed.kind === "badge_access") {
    return true;
  }

  if (!parsed.schedule) return false;

  const tenPM = timeToMinutes("22:00");

  for (const day of ALL_DAYS) {
    const hours = parsed.schedule[day];
    if (!hours) continue;

    const openMins = timeToMinutes(hours.open);
    const closeMins = timeToMinutes(hours.close);

    // Overnight (close < open)
    if (closeMins < openMins) return true;

    // Closes at or after 10 PM
    if (closeMins >= tenPM) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Season & day helpers
// ---------------------------------------------------------------------------

export function getSeason(date?: Date): Season {
  const month = (date || new Date()).getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

export function getDayOfWeekKey(date?: Date): DayKey {
  const d = date || new Date();
  return ALL_DAYS[d.getDay()];
}
