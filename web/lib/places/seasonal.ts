/**
 * Seasonal exhibition state helpers.
 *
 * CANONICAL SOURCE: all reads of `exhibition_type = 'seasonal'` MUST go through
 * this module. Don't inline season-date math in feed/search/detail code —
 * import `isPlaceInSeason` or `getActiveSeasonalExhibitions` instead.
 *
 * See spec: docs/superpowers/specs/2026-04-17-seasonal-attractions-design.md
 */

import { createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperatingHours = { open: string; close: string };

export type OperatingSchedule = {
  default_hours?: OperatingHours;
  days?: Partial<Record<DayName, OperatingHours | null>>;
  overrides?: Record<string, OperatingHours | null>; // YYYY-MM-DD keys
};

export type DayName =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export interface SeasonalExhibition {
  id: string;
  place_id: number;
  exhibition_type: "seasonal";
  opening_date: string; // YYYY-MM-DD
  closing_date: string; // YYYY-MM-DD
  operating_schedule: OperatingSchedule | null;
  title: string;
}

export type SeasonStatus = "active" | "pre-open" | "grace" | "off-season";

export interface SeasonState {
  status: SeasonStatus;
  daysToOpen: number | null;
  activeCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRE_OPEN_WINDOW_DAYS = 28;
const GRACE_PERIOD_DAYS = 7;

// ---------------------------------------------------------------------------
// Date utilities (timezone-agnostic — spec uses calendar dates only)
// ---------------------------------------------------------------------------

function parseDate(s: string): Date {
  // UTC midnight — matches ISO date-only parsing (`new Date("YYYY-MM-DD")`) so
  // test inputs and stored dates compare as the same calendar day regardless
  // of local TZ.
  return new Date(s + "T00:00:00Z");
}

function daysBetween(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUTC = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toUTC - fromUTC) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all `exhibition_type = 'seasonal'` rows for a place, regardless of date.
 * Caller filters by date via `isPlaceInSeason()` or `getPrimarySeasonalExhibition()`.
 */
export async function getSeasonalExhibitionsForPlace(
  placeId: number,
): Promise<SeasonalExhibition[]> {
  const client = createServiceClient();
  const { data } = await client
    .from("exhibitions")
    .select("id, place_id, exhibition_type, opening_date, closing_date, operating_schedule, title")
    .eq("place_id", placeId)
    .eq("exhibition_type", "seasonal")
    .eq("is_active", true);

  return (data as SeasonalExhibition[] | null) ?? [];
}

/**
 * Fetch active-OR-within-pre-open-window seasonal exhibitions for a place at a given date.
 * Returns an array — multiple can be active on overlap (Yule Forest: Pumpkin + Christmas).
 */
export async function getActiveSeasonalExhibitions(
  placeId: number,
  date: Date,
): Promise<SeasonalExhibition[]> {
  const all = await getSeasonalExhibitionsForPlace(placeId);
  return all.filter((e) => isWithinActiveOrPreOpen(e, date));
}

function isWithinActiveOrPreOpen(e: SeasonalExhibition, date: Date): boolean {
  const opening = parseDate(e.opening_date);
  const closing = parseDate(e.closing_date);
  // Active
  if (date >= opening && date <= closing) return true;
  // Pre-open
  const daysUntil = daysBetween(date, opening);
  if (daysUntil > 0 && daysUntil <= PRE_OPEN_WINDOW_DAYS) return true;
  return false;
}

/**
 * Tiebreaker for overlapping seasonal exhibitions at the same place:
 *   1. Prefer the exhibition with the LATEST opening_date (transition-forward).
 *   2. Break ties by earliest closing_date (urgency — "what closes soonest").
 */
export function getPrimarySeasonalExhibition(
  exhibitions: SeasonalExhibition[],
  date: Date,
): SeasonalExhibition | null {
  const candidates = exhibitions.filter((e) => isWithinActiveOrPreOpen(e, date));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.opening_date !== b.opening_date) {
      return a.opening_date < b.opening_date ? 1 : -1; // desc
    }
    return a.closing_date < b.closing_date ? -1 : 1; // asc
  });

  return candidates[0];
}

/**
 * Compute season status for a place given its seasonal exhibitions and a date.
 * Pass `getSeasonalExhibitionsForPlace()` result.
 */
export function isPlaceInSeason(
  exhibitions: SeasonalExhibition[],
  date: Date,
): SeasonState {
  let activeCount = 0;
  let preOpenDaysToOpen: number | null = null;
  let inGrace = false;

  for (const e of exhibitions) {
    const opening = parseDate(e.opening_date);
    const closing = parseDate(e.closing_date);

    if (date >= opening && date <= closing) {
      activeCount++;
      continue;
    }

    const daysUntil = daysBetween(date, opening);
    if (daysUntil > 0 && daysUntil <= PRE_OPEN_WINDOW_DAYS) {
      preOpenDaysToOpen =
        preOpenDaysToOpen === null
          ? daysUntil
          : Math.min(preOpenDaysToOpen, daysUntil);
      continue;
    }

    const daysPast = daysBetween(closing, date);
    if (daysPast >= 1 && daysPast <= GRACE_PERIOD_DAYS) {
      inGrace = true;
    }
  }

  if (activeCount > 0) {
    return { status: "active", daysToOpen: null, activeCount };
  }
  if (preOpenDaysToOpen !== null) {
    return { status: "pre-open", daysToOpen: preOpenDaysToOpen, activeCount: 0 };
  }
  if (inGrace) {
    return { status: "grace", daysToOpen: null, activeCount: 0 };
  }
  return { status: "off-season", daysToOpen: null, activeCount: 0 };
}

// ---------------------------------------------------------------------------
// Cadence formatting
// ---------------------------------------------------------------------------

const DAY_ORDER: DayName[] = [
  "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday", "sunday",
];

const DAY_SHORT: Record<DayName, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};

/**
 * Format an operating_schedule into a short display string.
 * Examples:
 *   "Sat–Sun 10:30–6"
 *   "Fri–Sun 5:30pm–10"
 *   "Nightly 5:30pm–9:30" (when default_hours set but no day-level detail)
 *   "Every day 10–6"
 *   "" (when schedule is null)
 */
export function formatCadence(schedule: OperatingSchedule | null): string {
  if (!schedule) return "";

  const days = schedule.days ?? {};
  const openDays = DAY_ORDER.filter((d) => days[d] != null);

  if (openDays.length === 0 && schedule.default_hours) {
    return `Nightly ${formatHourRange(schedule.default_hours)}`;
  }

  if (openDays.length === 7) {
    const sample = days[openDays[0]]!;
    return `Every day ${formatHourRange(sample)}`;
  }

  const cadenceLabel = formatDayRange(openDays);
  // Use hours from the first open day (assumes uniform hours; spec notes
  // mixed-hours fallback to just the cadence without suffix).
  const sample = days[openDays[0]];
  if (!sample) return cadenceLabel;

  const allSame = openDays.every(
    (d) =>
      days[d]?.open === sample.open &&
      days[d]?.close === sample.close,
  );
  return allSame
    ? `${cadenceLabel} ${formatHourRange(sample)}`
    : cadenceLabel;
}

function formatDayRange(days: DayName[]): string {
  if (days.length === 0) return "";
  if (days.length === 1) return DAY_SHORT[days[0]];
  const firstIdx = DAY_ORDER.indexOf(days[0]);
  const lastIdx = DAY_ORDER.indexOf(days[days.length - 1]);
  const isContiguous = lastIdx - firstIdx + 1 === days.length;
  if (isContiguous) return `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length - 1]]}`;
  return days.map((d) => DAY_SHORT[d]).join(", ");
}

function formatHourRange(h: OperatingHours): string {
  return `${formatHour(h.open)}–${formatHour(h.close, { stripMinutesOnEven: true })}`;
}

function formatHour(
  s: string,
  opts: { stripMinutesOnEven?: boolean } = {},
): string {
  const [hStr, mStr] = s.split(":");
  const h24 = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const isPM = h24 >= 12;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  // Close hour (stripMinutesOnEven): always drop suffix; drop minutes if :00.
  // Open hour: strip "am" for compactness, keep "pm" to disambiguate; preserve minutes.
  const suffix = opts.stripMinutesOnEven
    ? ""
    : isPM
      ? (h24 === 12 ? "" : "pm")
      : "";
  // For display compactness: "10:30–6" (drop close-hour minutes if :00)
  if (m === 0) {
    if (opts.stripMinutesOnEven) return `${h12}`;
    return `${h12}${suffix}`;
  }
  return `${h12}:${mStr}${suffix}`;
}
