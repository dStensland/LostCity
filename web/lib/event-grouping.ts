import { format, parseISO, isToday, isTomorrow } from "date-fns";
import type { EventWithLocation } from "@/lib/search";
import type { SeriesInfo, SeriesVenueGroup } from "@/components/SeriesCard";

// Rollup thresholds
const VENUE_ROLLUP_THRESHOLD = 4;
const CATEGORY_ROLLUP_THRESHOLD = 5;
const ROLLUP_CATEGORIES = ["community"];

/**
 * Display item types for the event list
 */
export type DisplayItem =
  | { type: "event"; event: EventWithLocation }
  | { type: "venue-group"; venueId: number; venueName: string; neighborhood: string | null; events: EventWithLocation[] }
  | { type: "category-group"; categoryId: string; categoryName: string; events: EventWithLocation[] }
  | { type: "series-group"; seriesId: string; series: SeriesInfo; venueGroups: SeriesVenueGroup[] };

/**
 * Time period for grouping events within a day
 */
export type TimePeriod = "morning" | "afternoon" | "evening" | "latenight";

/**
 * Labels for time periods
 */
export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  latenight: "Late Night",
};

/**
 * Get the time period for a given time string
 */
export function getTimePeriod(time: string | null): TimePeriod {
  if (!time) return "morning";
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "latenight";
}

/**
 * Group events into display items (individual events, venue groups, category groups, series groups)
 * Uses rollup thresholds to combine events from the same venue or category
 * Series events are grouped FIRST (highest priority), then venue, then category
 */
export function groupEventsForDisplay(events: EventWithLocation[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  const usedEventIds = new Set<number>();

  // FIRST PASS: Group series events by series_id
  // Series grouping takes highest priority - shows all showtimes for a series by venue
  const seriesGroups = new Map<string, EventWithLocation[]>();
  for (const event of events) {
    if (event.series_id && event.series) {
      const existing = seriesGroups.get(event.series_id) || [];
      existing.push(event);
      seriesGroups.set(event.series_id, existing);
    }
  }

  // Create series groups - group by venue within each series
  for (const [seriesId, seriesEvents] of seriesGroups) {
    // Get series info from first event
    const firstEvent = seriesEvents[0];
    const series = firstEvent.series!;

    // Group events by venue
    const venueMap = new Map<number, { venue: SeriesVenueGroup["venue"]; events: EventWithLocation[] }>();
    for (const event of seriesEvents) {
      if (event.venue) {
        const existing = venueMap.get(event.venue.id);
        if (existing) {
          existing.events.push(event);
        } else {
          venueMap.set(event.venue.id, {
            venue: {
              id: event.venue.id,
              name: event.venue.name,
              slug: event.venue.slug,
              neighborhood: event.venue.neighborhood,
            },
            events: [event],
          });
        }
      }
    }

    // Build venue groups with showtimes
    const venueGroups: SeriesVenueGroup[] = [];
    for (const { venue, events: venueEvents } of venueMap.values()) {
      // Sort by time
      venueEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      venueGroups.push({
        venue,
        showtimes: venueEvents.map((e) => ({ id: e.id, time: e.start_time })),
      });
    }

    // Sort venues by earliest showtime
    venueGroups.sort((a, b) =>
      (a.showtimes[0]?.time || "").localeCompare(b.showtimes[0]?.time || "")
    );

    items.push({
      type: "series-group",
      seriesId,
      series: {
        id: series.id,
        slug: series.slug,
        title: series.title,
        series_type: series.series_type,
        image_url: series.image_url,
      },
      venueGroups,
    });

    // Mark all series events as used
    seriesEvents.forEach((e) => usedEventIds.add(e.id));
  }

  // SECOND PASS: Find venue clusters (excluding series events)
  const venueGroups = new Map<number, EventWithLocation[]>();
  for (const event of events) {
    if (usedEventIds.has(event.id)) continue;
    if (event.venue?.id) {
      const existing = venueGroups.get(event.venue.id) || [];
      existing.push(event);
      venueGroups.set(event.venue.id, existing);
    }
  }

  // Create venue groups for venues with enough events
  for (const [venueId, venueEvents] of venueGroups) {
    if (venueEvents.length >= VENUE_ROLLUP_THRESHOLD) {
      const venue = venueEvents[0].venue!;
      items.push({
        type: "venue-group",
        venueId,
        venueName: venue.name,
        neighborhood: venue.neighborhood,
        events: venueEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
      });
      venueEvents.forEach((e) => usedEventIds.add(e.id));
    }
  }

  // THIRD PASS: Find category clusters (only for specific categories)
  const categoryGroups = new Map<string, EventWithLocation[]>();
  for (const event of events) {
    if (usedEventIds.has(event.id)) continue;
    if (event.category_id && ROLLUP_CATEGORIES.includes(event.category_id)) {
      const existing = categoryGroups.get(event.category_id) || [];
      existing.push(event);
      categoryGroups.set(event.category_id, existing);
    }
  }

  // Create category groups
  for (const [categoryId, catEvents] of categoryGroups) {
    if (catEvents.length >= CATEGORY_ROLLUP_THRESHOLD) {
      const categoryNames: Record<string, string> = {
        community: "Volunteer & Community",
      };
      items.push({
        type: "category-group",
        categoryId,
        categoryName: categoryNames[categoryId] || categoryId,
        events: catEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
      });
      catEvents.forEach((e) => usedEventIds.add(e.id));
    }
  }

  // FOURTH PASS: Add remaining events as individual items
  for (const event of events) {
    if (!usedEventIds.has(event.id)) {
      items.push({ type: "event", event });
    }
  }

  // Sort by earliest start time
  items.sort((a, b) => {
    const getFirstTime = (item: DisplayItem): string => {
      if (item.type === "event") return item.event.start_time || "00:00";
      if (item.type === "series-group") return item.venueGroups[0]?.showtimes[0]?.time || "00:00";
      return item.events[0]?.start_time || "00:00";
    };
    return getFirstTime(a).localeCompare(getFirstTime(b));
  });

  return items;
}

/**
 * Get the first time for a display item (used for sorting/grouping)
 */
function getFirstTimeForItem(item: DisplayItem): string | null {
  if (item.type === "event") return item.event.start_time;
  if (item.type === "series-group") return item.venueGroups[0]?.showtimes[0]?.time || null;
  return item.events[0]?.start_time || null;
}

/**
 * Group display items by time period
 */
export function groupByTimePeriod(items: DisplayItem[]): { period: TimePeriod; items: DisplayItem[] }[] {
  const groups: Map<TimePeriod, DisplayItem[]> = new Map();
  const periods: TimePeriod[] = ["morning", "afternoon", "evening", "latenight"];

  for (const item of items) {
    const time = getFirstTimeForItem(item);
    const period = getTimePeriod(time);
    if (!groups.has(period)) groups.set(period, []);
    groups.get(period)!.push(item);
  }

  // Return in order, only non-empty periods
  return periods
    .filter((p) => groups.has(p) && groups.get(p)!.length > 0)
    .map((p) => ({ period: p, items: groups.get(p)! }));
}

/**
 * Get human-readable date label
 */
export function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: EventWithLocation[]): Record<string, EventWithLocation[]> {
  return events.reduce(
    (acc, event) => {
      const date = event.start_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, EventWithLocation[]>
  );
}

/**
 * Get sorted dates from events
 */
export function getSortedDates(eventsByDate: Record<string, EventWithLocation[]>): string[] {
  return Object.keys(eventsByDate).sort();
}
