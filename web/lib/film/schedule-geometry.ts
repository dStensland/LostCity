export const SCHEDULE_START_HOUR = 11;
export const SCHEDULE_END_HOUR = 25;
export const PX_PER_MINUTE = 3;
export const ROW_HEIGHT = 72;
export const CELL_MIN_WIDTH = 48;
export const TIER_DIVIDER_HEIGHT = 32;

export const GRID_WIDTH_PX =
  (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60 * PX_PER_MINUTE;

// Atlanta sunset approximate table (month index 0-11 → HH:MM local).
// Good enough for v1 drive-in marker; real suncalc integration deferred.
const ATLANTA_SUNSET_BY_MONTH: Record<number, string> = {
  0: '17:45', // Jan
  1: '18:15', // Feb
  2: '19:45', // Mar (DST kick)
  3: '20:10', // Apr
  4: '20:35', // May
  5: '20:52', // Jun
  6: '20:50', // Jul
  7: '20:22', // Aug
  8: '19:42', // Sep
  9: '19:00', // Oct
  10: '17:30', // Nov
  11: '17:30', // Dec
};

export function minutesSinceStart(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  // Map 00:00–03:00 to next-day (+24h) so the grid covers midnight
  if (h < SCHEDULE_START_HOUR - 3) h += 24;
  return (h - SCHEDULE_START_HOUR) * 60 + m;
}

export function cellLeft(hhmm: string): number {
  return minutesSinceStart(hhmm) * PX_PER_MINUTE;
}

export function cellWidth(runtimeMinutes: number | null | undefined): number {
  const minutes = runtimeMinutes ?? 0;
  return Math.max(minutes * PX_PER_MINUTE, CELL_MIN_WIDTH);
}

export function currentTimeMinutes(now: Date, selectedDate: string): number | null {
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (selectedDate !== todayIso) return null;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const offset = minutesSinceStart(`${hh}:${mm}`);
  if (offset < 0 || offset > (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60) {
    return null;
  }
  return offset;
}

export function sunsetMinutesForDate(dateIso: string): number {
  const month = Number(dateIso.slice(5, 7)) - 1; // 0-11
  const hhmm = ATLANTA_SUNSET_BY_MONTH[month] ?? '19:45';
  return minutesSinceStart(hhmm);
}

export function hoursLabels(): Array<{ label: string; minutes: number }> {
  const out: Array<{ label: string; minutes: number }> = [];
  for (let h = SCHEDULE_START_HOUR; h <= SCHEDULE_END_HOUR; h += 1) {
    // Normalize hour to 1-12 with AM/PM:
    // 11 → 11 AM, 12 → 12 PM, 13–23 → 1–11 PM, 24 → 12 AM, 25 → 1 AM
    let displayHour: number;
    let isAm: boolean;
    if (h === 12) { displayHour = 12; isAm = false; }
    else if (h === 24) { displayHour = 12; isAm = true; }
    else if (h < 12) { displayHour = h; isAm = true; }
    else if (h > 24) { displayHour = h - 24; isAm = true; }
    else { displayHour = h - 12; isAm = false; }
    const label = `${displayHour} ${isAm ? 'AM' : 'PM'}`;
    out.push({ label, minutes: (h - SCHEDULE_START_HOUR) * 60 });
  }
  return out;
}
