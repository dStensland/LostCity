/**
 * Format recurrence pattern for display
 * Converts database fields to human-readable text like "Every Thursday"
 */

export type Frequency = "weekly" | "biweekly" | "monthly" | "daily" | null;
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | null;

const DAY_NAMES: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const FREQUENCY_PREFIX: Record<string, string> = {
  weekly: "Every",
  biweekly: "Every other",
  monthly: "Monthly on",
  daily: "Daily",
};

/**
 * Format recurrence pattern for display
 * @param frequency - How often the event recurs
 * @param dayOfWeek - Which day of the week (for weekly/biweekly)
 * @returns Human-readable string like "Every Thursday" or null if not recurring
 */
export function formatRecurrence(frequency: Frequency, dayOfWeek: DayOfWeek): string | null {
  if (!frequency) return null;

  // Daily doesn't need a day of week
  if (frequency === "daily") {
    return "Daily";
  }

  // Weekly and biweekly need a day
  if ((frequency === "weekly" || frequency === "biweekly") && dayOfWeek) {
    const prefix = FREQUENCY_PREFIX[frequency];
    const day = DAY_NAMES[dayOfWeek] || dayOfWeek;
    return `${prefix} ${day}`;
  }

  // Monthly with day
  if (frequency === "monthly" && dayOfWeek) {
    const day = DAY_NAMES[dayOfWeek] || dayOfWeek;
    return `Monthly on ${day}s`;
  }

  // Generic fallback
  if (frequency === "weekly") return "Weekly";
  if (frequency === "biweekly") return "Biweekly";
  if (frequency === "monthly") return "Monthly";

  return null;
}

/**
 * Get a short version of the recurrence pattern
 * @returns Abbreviated text like "Weekly" or "Thu" for compact displays
 */
export function formatRecurrenceShort(frequency: Frequency, dayOfWeek: DayOfWeek): string | null {
  if (!frequency) return null;

  if (frequency === "daily") return "Daily";

  if (dayOfWeek) {
    const shortDays: Record<string, string> = {
      monday: "Mon",
      tuesday: "Tue",
      wednesday: "Wed",
      thursday: "Thu",
      friday: "Fri",
      saturday: "Sat",
      sunday: "Sun",
    };
    return shortDays[dayOfWeek] || dayOfWeek.slice(0, 3);
  }

  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

// ---------------------------------------------------------------------------
// RRULE parsing — for events that store recurrence as iCalendar RRULE strings
// ---------------------------------------------------------------------------

const RRULE_DAY_NAMES: Record<string, string> = {
  MO: "Monday", TU: "Tuesday", WE: "Wednesday",
  TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday",
};

const RRULE_SHORT_DAY_NAMES: Record<string, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed",
  TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};

/**
 * Parse an iCalendar RRULE string into a human-readable label.
 * e.g. "FREQ=WEEKLY;BYDAY=TH" → "Every Thursday"
 */
export function parseRecurrenceRule(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const match = rule.match(/FREQ=(\w+)(?:;BYDAY=([\w,]+))?/i);
  if (!match) return null;

  const freq = match[1]?.toUpperCase();
  const days = match[2];

  if (freq === "WEEKLY" && days) {
    const dayList = days.split(",");
    if (dayList.length === 1 && RRULE_DAY_NAMES[dayList[0]]) {
      return `Every ${RRULE_DAY_NAMES[dayList[0]]}`;
    }
    const names = dayList.map(d => RRULE_SHORT_DAY_NAMES[d]).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (freq === "WEEKLY") return "Weekly";
  if (freq === "MONTHLY") return "Monthly";
  if (freq === "DAILY") return "Daily";

  return null;
}

/**
 * Extract short day names from an RRULE BYDAY clause.
 * e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR" → ["Mon", "Wed", "Fri"]
 */
export function parseRecurrenceDays(rule: string | null | undefined): string[] {
  if (!rule) return [];
  const match = rule.match(/BYDAY=([\w,]+)/i);
  if (!match) return [];
  return match[1].split(",").map(d => RRULE_SHORT_DAY_NAMES[d]).filter(Boolean);
}
