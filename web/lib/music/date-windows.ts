import { getLocalDateString, addDaysToDateString } from "@/lib/formats";

/**
 * ISO week (Mon–Sun) containing `now` in America/New_York. Returns inclusive
 * YYYY-MM-DD bounds. Timezone-safe: avoids UTC-biased Date math so Sunday
 * evenings ET on Vercel don't roll into next week.
 */
export function isoWeekRange(
  now: Date = new Date(),
): { start: string; end: string } {
  const todayStr = getLocalDateString(now);
  // Parse ET-local date parts, compute day-of-week from a noon-local Date
  // (noon dodges DST edge cases).
  const [y, m, d] = todayStr.split("-").map(Number);
  const etNoon = new Date(y, m - 1, d, 12, 0, 0);
  const day = (etNoon.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const start = addDaysToDateString(todayStr, -day);
  const end = addDaysToDateString(start, 6);
  return { start, end };
}
