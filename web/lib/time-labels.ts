import { differenceInMinutes, format, parseISO } from "date-fns";

/**
 * Parses a YYYY-MM-DD date string and optional HH:MM:SS time string into a Date object.
 * Returns null if the input is invalid.
 */
function parseEventDateTime(
  date: string,
  time: string | null
): Date | null {
  try {
    if (time) {
      const [h, m] = time.split(":").map(Number);
      const d = parseISO(date);
      d.setHours(h, m, 0, 0);
      return d;
    }
    return parseISO(date);
  } catch {
    return null;
  }
}

/**
 * Returns a YYYY-MM-DD string for a given Date using local time.
 * Avoids timezone issues from calling .toISOString() on local dates.
 */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formats a 12-hour time string from a Date object.
 * Output: "8 PM", "12:30 PM", "10:15 AM" (no leading zero on hour).
 */
function formatTime12h(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${hour12} ${period}`;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Returns a contextual time label for an event based on how soon it starts.
 * Used to replace static "8:00 PM" with "Starts in 2 hours" when relevant.
 *
 * @param startDate  YYYY-MM-DD
 * @param startTime  HH:MM:SS or null
 * @param endDate    YYYY-MM-DD or null (exhibition closing date)
 * @param isAllDay   true for all-day events
 * @param now        injectable for testing; defaults to new Date()
 * @returns contextual label, or "" if none applies (caller uses standard formatting)
 */
export function getContextualTimeLabel(
  startDate: string,
  startTime: string | null,
  endDate: string | null,
  isAllDay: boolean,
  now?: Date
): string {
  const currentTime = now ?? new Date();

  const startDt = parseEventDateTime(startDate, startTime);
  if (!startDt) return "";

  // 1. Happening now: event has started and has not ended.
  //    Use endDate if set, otherwise assume 2-hour default duration.
  if (startTime) {
    const minutesSinceStart = differenceInMinutes(currentTime, startDt);
    if (minutesSinceStart >= 0) {
      let isOver = false;
      if (endDate) {
        // End-of-day on endDate counts as the exhibition closing
        const closingDay = parseISO(endDate);
        closingDay.setHours(23, 59, 59, 999);
        isOver = currentTime > closingDay;
      } else {
        // Default: 2-hour window
        isOver = minutesSinceStart > 120;
      }
      if (!isOver) return "Happening now";
    }
  }

  const minutesUntilStart = differenceInMinutes(startDt, currentTime);

  // 2. Starts within 1 hour
  if (minutesUntilStart >= 0 && minutesUntilStart < 60) {
    const mins = Math.max(1, Math.round(minutesUntilStart));
    return `Starts in ${mins} min`;
  }

  // 3. Starts within 4 hours
  if (minutesUntilStart >= 60 && minutesUntilStart < 240) {
    const hours = Math.round(minutesUntilStart / 60);
    return `Starts in ${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  // 4. All-day event starting today
  if (isAllDay && startDate === toLocalDateString(currentTime)) {
    return "All day today";
  }

  // 5. Tomorrow
  const tomorrowDate = new Date(currentTime);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (startDate === toLocalDateString(tomorrowDate)) {
    if (startTime) {
      const timeLabel = formatTime12h(startDt);
      return `Tomorrow at ${timeLabel}`;
    }
    return "Tomorrow";
  }

  // 6. Exhibition closing soon (endDate within 3 days from now).
  //    Compare against end-of-day so a show closing "today" always shows "Last day"
  //    regardless of current time of day.
  if (endDate) {
    const closingDay = parseISO(endDate);
    closingDay.setHours(23, 59, 59, 999);
    const daysUntilClose = differenceInMinutes(closingDay, currentTime) / (60 * 24);
    if (daysUntilClose >= 0 && daysUntilClose < 1) {
      return "Last day";
    }
    if (daysUntilClose >= 1 && daysUntilClose < 3) {
      return `Closes ${format(parseISO(endDate), "EEEE")}`;
    }
  }

  // 7. No contextual label — caller uses standard formatting
  return "";
}
