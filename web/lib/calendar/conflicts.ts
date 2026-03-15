import type { CalendarEvent } from "@/lib/types/calendar";

function parseTimeToMinutes(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Find events that overlap with a given event on the same date.
 * Only considers timed events (all-day events don't create conflicts).
 */
export function findConflicts(
  newEvent: CalendarEvent,
  existingEvents: CalendarEvent[]
): CalendarEvent[] {
  if (newEvent.is_all_day || !newEvent.start_time) return [];

  const newStart = parseTimeToMinutes(newEvent.start_time);
  const newEnd = newEvent.end_time
    ? parseTimeToMinutes(newEvent.end_time)
    : newStart !== null
      ? newStart + 60
      : null;

  if (newStart === null || newEnd === null) return [];

  return existingEvents.filter((event) => {
    if (event.id === newEvent.id) return false;
    if (event.is_all_day || !event.start_time) return false;
    if (event.start_date !== newEvent.start_date) return false;

    const eStart = parseTimeToMinutes(event.start_time);
    const eEnd = event.end_time
      ? parseTimeToMinutes(event.end_time)
      : eStart !== null
        ? eStart + 60
        : null;

    if (eStart === null || eEnd === null) return false;

    // Overlap check: !(end1 <= start2 || start1 >= end2)
    return !(newEnd <= eStart || newStart >= eEnd);
  });
}
