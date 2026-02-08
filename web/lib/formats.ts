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

  const parts = time.split(":");
  if (parts.length < 2) return "TBA";

  const hours = parts[0];
  const minutes = parts[1];
  const hour = parseInt(hours, 10);

  if (isNaN(hour) || hour < 0 || hour > 23) {
    return "TBA";
  }

  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}${period}`;
}

/**
 * Format time with separate time and period for styling flexibility.
 * Returns { time: "7:30", period: "pm" } or { time: "All Day", period: "" } for all-day events
 */
export function formatTimeSplit(time: string | null, isAllDay?: boolean): { time: string; period: string } {
  if (isAllDay) return { time: "All Day", period: "" };
  if (!time) return { time: "TBA", period: "" };

  const parts = time.split(":");
  if (parts.length < 2) return { time: "TBA", period: "" };

  const hours = parts[0];
  const minutes = parts[1];
  const hour = parseInt(hours, 10);

  if (isNaN(hour) || hour < 0 || hour > 23) {
    return { time: "TBA", period: "" };
  }

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

  const startParts = startTime.split(":");
  const endParts = endTime.split(":");

  if (startParts.length < 2 || endParts.length < 2) return null;

  const [startH, startM] = startParts.map(Number);
  const [endH, endM] = endParts.map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;

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
/**
 * Format a date as a smart contextual label: "Today", "Wed", "1/28"
 * Uses compact format for narrow time cells
 */
export function formatSmartDate(dateStr: string): { label: string; isHighlight: boolean } {
  const date = new Date(dateStr + "T00:00:00"); // Parse as local date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Check if same day
  if (date.getTime() === today.getTime()) {
    return { label: "Today", isHighlight: true };
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Check if tomorrow - show day abbreviation with highlight
  if (date.getTime() === tomorrow.getTime()) {
    return { label: dayNames[date.getDay()], isHighlight: true };
  }

  // Within next 7 days - show day name
  if (date < nextWeek) {
    return { label: dayNames[date.getDay()], isHighlight: false };
  }

  // Further out - show compact "M/D" format (e.g., "1/28")
  return { label: `${date.getMonth() + 1}/${date.getDate()}`, isHighlight: false };
}

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

  // Don't show estimated prices - return empty string for venue/category defaults
  return { text: "", isFree: false, isEstimate: false };
}

// ============================================================================
// COUNT FORMATTING
// ============================================================================

/**
 * Format large counts with compact suffixes: 950 -> "950", 1,200 -> "1.2k", 12,400 -> "12k"
 */
export function formatCompactCount(count: number): string {
  if (!Number.isFinite(count)) return "0";
  if (count < 1000) return `${count}`;
  if (count < 10_000) {
    const formatted = (count / 1000).toFixed(1);
    return `${formatted.replace(/\.0$/, "")}k`;
  }
  if (count < 1_000_000) {
    return `${Math.round(count / 1000)}k`;
  }
  const formatted = (count / 1_000_000).toFixed(1);
  return `${formatted.replace(/\.0$/, "")}m`;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Get today's date as a string in local timezone (YYYY-MM-DD format).
 * IMPORTANT: Do NOT use `new Date().toISOString().split("T")[0]` as that
 * returns UTC date which is wrong after ~7pm EST (it becomes next day in UTC).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get a date string for N days from now in local timezone.
 */
export function getLocalDateStringOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

// ============================================================================
// TEXT UTILITIES
// ============================================================================

/**
 * Decode HTML entities in text (e.g. &#8211; → –, &amp; → &).
 * Common in crawled data where source HTML entities leak into titles.
 */
export function decodeHtmlEntities(str: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&ndash;": "\u2013",
    "&mdash;": "\u2014",
    "&lsquo;": "\u2018",
    "&rsquo;": "\u2019",
    "&ldquo;": "\u201C",
    "&rdquo;": "\u201D",
    "&hellip;": "\u2026",
  };
  let result = str;
  for (const [entity, char] of Object.entries(named)) {
    result = result.replace(new RegExp(entity, "gi"), char);
  }
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

/**
 * Safely encode JSON-LD schema for use in <script type="application/ld+json">.
 * Escapes </script> sequences to prevent XSS if database values contain that string.
 */
export function safeJsonLd(schema: object): string {
  return JSON.stringify(schema).replace(/<\/script>/gi, "<\\/script>");
}
