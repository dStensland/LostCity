/**
 * bucketEvents — pure util to partition a flat event list into
 * TONIGHT / THIS WEEKEND / NEXT WEEK / LATER buckets, time-zone aware.
 *
 * Used by the neighborhood detail page to render section dividers over a
 * chronological list. Pure / no side effects / no DB calls — safe for unit
 * tests with `vi.setSystemTime`.
 *
 * Bucketing rules (first match wins):
 *   tonight:   start_date === today AND (is_all_day OR start_time >= "17:00")
 *   weekend:   start_date between tomorrow and end-of-next-Sunday, excluding
 *              Friday day (start_time < "17:00") — Friday morning isn't weekend
 *   nextWeek:  start_date within the Monday–Sunday AFTER this weekend
 *   later:     everything else (including today-morning events already in the
 *              past and far-future events)
 */

type EventLike = {
  start_date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM or HH:MM:SS
  is_all_day?: boolean | null;
};

export type EventBuckets<T extends EventLike> = {
  tonight: T[];
  weekend: T[];
  nextWeek: T[];
  later: T[];
};

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const EVENING_CUTOFF = "17:00";

function toDateStrInTz(d: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayOfWeekInTz(dateStr: string, timezone: string): number {
  // Use noon UTC to avoid DST edge-case misattribution at midnight.
  const d = new Date(`${dateStr}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const name = fmt.format(d);
  return DOW_SHORT.indexOf(name as (typeof DOW_SHORT)[number]);
}

function addDaysToDateStr(dateStr: string, days: number): string {
  // ISO date arithmetic via UTC noon to dodge DST.
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeTime(t: string | null | undefined): string | null {
  if (!t) return null;
  // Strip seconds if present: "19:00:00" → "19:00"
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export function bucketEvents<T extends EventLike>(
  events: T[],
  now: Date,
  timezone: string,
): EventBuckets<T> {
  const todayStr = toDateStrInTz(now, timezone);
  const todayDow = dayOfWeekInTz(todayStr, timezone);

  // End of THIS weekend = end of the upcoming Sunday (inclusive).
  // Sun=0: today is Sunday, weekend ends today.
  // Mon=1..Sat=6: days until next Sunday.
  const daysToEndOfWeekend = todayDow === 0 ? 0 : 7 - todayDow;
  const endOfWeekendStr = addDaysToDateStr(todayStr, daysToEndOfWeekend);

  // NEXT week = the 7 days following this weekend (Mon..Sun).
  const startOfNextWeekStr = addDaysToDateStr(endOfWeekendStr, 1);
  const endOfNextWeekStr = addDaysToDateStr(startOfNextWeekStr, 6);

  const buckets: EventBuckets<T> = {
    tonight: [],
    weekend: [],
    nextWeek: [],
    later: [],
  };

  for (const ev of events) {
    const date = ev.start_date;
    const time = normalizeTime(ev.start_time);
    const isAllDay = ev.is_all_day === true;

    // TONIGHT — today's evening or all-day
    if (date === todayStr) {
      if (isAllDay || (time !== null && time >= EVENING_CUTOFF)) {
        buckets.tonight.push(ev);
      } else {
        // Today earlier-than-evening (already in the past for most users
        // viewing after 5pm, OR a morning event they're checking ahead of time)
        buckets.later.push(ev);
      }
      continue;
    }

    // WEEKEND — tomorrow through end of upcoming Sunday, with Friday-day carve-out
    if (date > todayStr && date <= endOfWeekendStr) {
      const eventDow = dayOfWeekInTz(date, timezone);
      // Friday BEFORE 5pm is not "weekend" — it's still the workweek.
      // Friday evening + Sat + Sun = weekend.
      if (eventDow === 5 /* Fri */ && !isAllDay && (time === null || time < EVENING_CUTOFF)) {
        buckets.later.push(ev);
      } else {
        buckets.weekend.push(ev);
      }
      continue;
    }

    // NEXT WEEK — Mon..Sun of the week after this weekend
    if (date >= startOfNextWeekStr && date <= endOfNextWeekStr) {
      buckets.nextWeek.push(ev);
      continue;
    }

    // LATER — everything else (far future, accidentally-past-today, etc.)
    buckets.later.push(ev);
  }

  return buckets;
}
