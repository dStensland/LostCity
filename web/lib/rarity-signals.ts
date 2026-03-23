import { differenceInMinutes, format, parseISO } from "date-fns";

export type RaritySignal = {
  type: "one_night_only" | "new_venue" | "closing_soon";
  label: string;
};

/**
 * Returns a rarity signal badge for events that are unusual or fleeting.
 * `new_venue` is reserved for v2 (requires venue.created_at, not on the event type).
 *
 * @param event    Minimal event shape with scheduling fields
 * @param now      Injectable for testing; defaults to new Date()
 * @returns RaritySignal or null
 */
export function getRaritySignal(
  event: {
    start_date: string;
    end_date?: string | null;
    series_id?: number | null;
    is_recurring?: boolean;
  },
  now?: Date
): RaritySignal | null {
  const currentTime = now ?? new Date();

  // 1. One Night Only: no series, not recurring, no multi-day span
  const isSingleNight =
    !event.series_id &&
    !event.is_recurring &&
    (event.end_date == null || event.end_date === event.start_date);

  if (isSingleNight) {
    return { type: "one_night_only", label: "One Night Only" };
  }

  // 2. Closing Soon: multi-day/exhibition event ending within 3 days.
  //    Use end-of-day so a show closing "today" always shows "Last Day"
  //    regardless of current time of day.
  if (event.end_date && event.end_date !== event.start_date) {
    const closingDay = parseISO(event.end_date);
    closingDay.setHours(23, 59, 59, 999);
    const daysUntilClose =
      differenceInMinutes(closingDay, currentTime) / (60 * 24);

    if (daysUntilClose >= 0 && daysUntilClose < 1) {
      return { type: "closing_soon", label: "Last Day" };
    }
    if (daysUntilClose >= 1 && daysUntilClose < 3) {
      return {
        type: "closing_soon",
        label: `Closes ${format(parseISO(event.end_date), "EEEE")}`,
      };
    }
  }

  return null;
}
