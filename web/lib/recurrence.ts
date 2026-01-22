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
