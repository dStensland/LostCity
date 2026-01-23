/**
 * Consolidated formatting utilities for time and price display.
 * Previously duplicated across 6+ files - now centralized here.
 */

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format time as a simple string: "7:30pm" or "TBA"
 */
export function formatTime(time: string | null, isAllDay?: boolean): string {
  if (isAllDay) return "All Day";
  if (!time) return "TBA";

  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}${period}`;
}

/**
 * Format time with separate time and period for styling flexibility.
 * Returns { time: "7:30", period: "pm" }
 */
export function formatTimeSplit(time: string | null, isAllDay?: boolean): { time: string; period: string } {
  if (isAllDay) return { time: "All", period: "Day" };
  if (!time) return { time: "TBA", period: "" };

  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return { time: `${hour12}:${minutes}`, period };
}

/**
 * Format a time range: "8PM → 11PM" or "8PM" if no end time
 */
export function formatTimeRange(
  startTime: string | null,
  endTime: string | null,
  isAllDay?: boolean
): string {
  if (isAllDay) return "All Day";
  if (!startTime) return "TBA";

  const start = formatTime(startTime);
  if (!endTime) return start;

  const end = formatTime(endTime);
  return `${start} → ${end}`;
}

/**
 * Calculate and format duration between two times.
 * Returns "3 hours" or "1.5 hours" or null if can't calculate.
 */
export function formatDuration(
  startTime: string | null,
  endTime: string | null
): string | null {
  if (!startTime || !endTime) return null;

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Handle events that cross midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes = endMinutes - startMinutes;
  const hours = durationMinutes / 60;

  if (hours === 1) return "1 hour";
  if (hours === Math.floor(hours)) return `${hours} hours`;
  return `${hours.toFixed(1)} hours`;
}

// ============================================================================
// PRICE FORMATTING
// ============================================================================

export interface PriceableEvent {
  is_free?: boolean | null;
  price_min?: number | null;
  price_max?: number | null;
  // Allow any venue object that may have price info
  venue?: {
    typical_price_min?: number | null;
    typical_price_max?: number | null;
    [key: string]: unknown;
  } | null;
  category_data?: {
    typical_price_min?: number | null;
    typical_price_max?: number | null;
  } | null;
}

export interface PriceFormatResult {
  text: string;
  isFree: boolean;
  isEstimate: boolean;
}

/**
 * Format price as a simple string: "Free", "$25", "$25–50", "~$20", "—"
 */
export function formatPrice(event: PriceableEvent): string {
  return formatPriceDetailed(event).text;
}

/**
 * Format price with metadata about whether it's free or an estimate.
 * Useful for styling (green badge for free, italics for estimate).
 */
export function formatPriceDetailed(event: PriceableEvent): PriceFormatResult {
  // Explicit free
  if (event.is_free) {
    return { text: "Free", isFree: true, isEstimate: false };
  }

  // Has explicit price
  if (event.price_min !== null && event.price_min !== undefined) {
    if (event.price_min === event.price_max || event.price_max === null) {
      return { text: `$${event.price_min}`, isFree: false, isEstimate: false };
    }
    return { text: `$${event.price_min}–${event.price_max}`, isFree: false, isEstimate: false };
  }

  // Try venue typical price first (more specific)
  const venueMin = event.venue?.typical_price_min;
  const venueMax = event.venue?.typical_price_max;
  if (venueMin !== null && venueMin !== undefined) {
    if (venueMin === 0 && venueMax === 0) {
      return { text: "Free", isFree: true, isEstimate: true };
    }
    if (venueMin === venueMax || venueMax === null || venueMax === undefined) {
      return { text: `~$${venueMin}`, isFree: false, isEstimate: true };
    }
    return { text: `~$${venueMin}–${venueMax}`, isFree: false, isEstimate: true };
  }

  // Fall back to category typical price
  const catMin = event.category_data?.typical_price_min;
  const catMax = event.category_data?.typical_price_max;
  if (catMin !== null && catMin !== undefined) {
    if (catMin === 0 && catMax === 0) {
      return { text: "Free", isFree: true, isEstimate: true };
    }
    if (catMin === catMax || catMax === null || catMax === undefined) {
      return { text: `~$${catMin}`, isFree: false, isEstimate: true };
    }
    return { text: `~$${catMin}–${catMax}`, isFree: false, isEstimate: true };
  }

  return { text: "—", isFree: false, isEstimate: false };
}
