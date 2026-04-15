// web/lib/detail/format.ts

/**
 * Format event time display.
 * Returns null if no meaningful time data exists.
 */
export function formatEventTime(
  isAllDay: boolean,
  startTime: string | null,
  endTime: string | null,
): string | null {
  if (isAllDay) return "All Day";
  if (!startTime) return null;

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const start = formatTime(startTime);
  if (!endTime) return start;
  return `${start} – ${formatTime(endTime)}`;
}

/**
 * Format price range display.
 * Returns null if no price info.
 */
export function formatPriceRange(
  isFree: boolean,
  priceMin: number | null,
  priceMax: number | null,
): string | null {
  if (isFree) return "Free";
  if (priceMin == null) return null;
  if (priceMax == null || priceMax === priceMin) return `$${priceMin}`;
  return `$${priceMin}–$${priceMax}`;
}

/**
 * Format date range (e.g., "Apr 24 – May 3").
 * Returns null if no dates.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start) return null;

  const fmt = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!end || start === end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Format recurrence label (e.g., "Every Tuesday").
 * Returns null if no recurrence data.
 */
export function formatRecurrence(
  frequency: string | null | undefined,
  dayOfWeek: string | null | undefined,
): string | null {
  if (!frequency && !dayOfWeek) return null;
  if (dayOfWeek) {
    const prefix = frequency === "biweekly" ? "Every other" : "Every";
    return `${prefix} ${dayOfWeek}`;
  }
  return frequency ? `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}` : null;
}

/**
 * Format duration from minutes.
 * Returns null if no data — never fabricates a default.
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
}
