/**
 * Cursor-based pagination utilities
 *
 * Cursor format encodes: start_date + start_time + id
 * This allows stable keyset pagination that doesn't break when data changes
 */

export interface CursorData {
  d: string;      // start_date (YYYY-MM-DD)
  t: string;      // start_time (HH:MM:SS or "00:00:00" for null)
  i: number;      // event id
}

/**
 * Encode an event into a cursor string (base64url)
 */
export function encodeCursor(startDate: string, startTime: string | null, id: number): string {
  const data: CursorData = {
    d: startDate,
    t: startTime || "00:00:00",
    i: id,
  };
  // Use base64url encoding (URL-safe)
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

/**
 * Decode a cursor string back to its components
 * Returns null if invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const data = JSON.parse(decoded) as CursorData;

    // Validate required fields
    if (!data.d || typeof data.d !== "string") return null;
    if (!data.t || typeof data.t !== "string") return null;
    if (typeof data.i !== "number") return null;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.d)) return null;

    // Validate time format (HH:MM:SS)
    if (!/^\d{2}:\d{2}:\d{2}$/.test(data.t)) return null;

    return data;
  } catch {
    return null;
  }
}

/**
 * Generate cursor from the last event in a list
 */
export function generateNextCursor(events: Array<{ start_date: string; start_time: string | null; id: number }>): string | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  return encodeCursor(last.start_date, last.start_time, last.id);
}
