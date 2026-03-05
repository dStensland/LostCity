/**
 * Shared types and utilities for venue specials.
 * Used by VenueSpecialsSection (venue detail) and future specials consumers.
 */

export type VenueSpecial = {
  id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  price_note: string | null;
  image_url: string | null;
  source_url: string | null;
};

/** ISO 8601 day labels: 1=Mon, 2=Tue, ..., 7=Sun */
const ISO_DAY_LABELS: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

/** Format ISO 8601 day array → "Mon–Fri", "Weekends", "Mon, Wed, Fri", etc.
 *  Input: days_of_week from DB (1=Mon, 7=Sun). */
export function formatDays(days: number[] | null): string | null {
  if (!days || days.length === 0) return null;
  if (days.length === 7) return "Every day";
  const sorted = [...days].sort();
  // Mon(1)–Fri(5)
  if (sorted.length === 5 && sorted[0] === 1 && sorted[4] === 5)
    return "Mon\u2013Fri";
  // Sat(6) + Sun(7)
  if (sorted.length === 2 && sorted[0] === 6 && sorted[1] === 7)
    return "Weekends";
  return sorted.map((d) => ISO_DAY_LABELS[d] ?? "").join(", ");
}

/** Format time window → "4pm–7pm", "11am", etc. */
export function formatTimeWindow(
  start: string | null,
  end: string | null,
): string | null {
  if (!start) return null;
  const fmt = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    const period = hour >= 12 ? "pm" : "am";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return m === "00"
      ? `${displayHour}${period}`
      : `${displayHour}:${m}${period}`;
  };
  if (!end) return fmt(start);
  return `${fmt(start)}\u2013${fmt(end)}`;
}

/** Convert JS getDay() (0=Sun, 6=Sat) to ISO 8601 (1=Mon, 7=Sun). */
function jsToIsoDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** Check if a special is active right now (day + time window).
 *  days_of_week in DB uses ISO 8601: 1=Mon, 2=Tue, ..., 7=Sun. */
export function isActiveNow(special: Pick<VenueSpecial, "days_of_week" | "time_start" | "time_end">): boolean {
  const now = new Date();
  const currentDay = jsToIsoDay(now.getDay());
  if (special.days_of_week && !special.days_of_week.includes(currentDay))
    return false;
  if (!special.time_start) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = special.time_start.split(":").map(Number);
  const startMin = sh * 60 + (sm || 0);
  if (special.time_end) {
    const [eh, em] = special.time_end.split(":").map(Number);
    const endMin = eh * 60 + (em || 0);
    return nowMinutes >= startMin && nowMinutes <= endMin;
  }
  // No end time — active within 3 hours of start
  return nowMinutes >= startMin && nowMinutes <= startMin + 180;
}

export const TYPE_LABELS: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch: "Brunch",
  drink_special: "Drink Special",
  food_special: "Food Special",
  late_night: "Late Night",
  recurring_deal: "Deal",
};
