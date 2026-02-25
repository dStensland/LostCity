import { format, parseISO, isToday, isTomorrow } from "date-fns";
import type { EventWithLocation } from "@/lib/search";
import type { SeriesInfo, SeriesVenueGroup } from "@/components/SeriesCard";
import type { Festival } from "@/lib/festivals";
import { isSuppressedFromGeneralEventFeed } from "@/lib/event-content-classification";

// Rollup thresholds
const VENUE_ROLLUP_THRESHOLD = 4;
const CATEGORY_ROLLUP_THRESHOLD = 5;
const ROLLUP_CATEGORIES = ["community"];

/**
 * Summary info for festival/convention collapsed display
 */
export interface FestivalInfo {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  festival_type?: string | null;
  location?: string | null;
  neighborhood?: string | null;
  free?: boolean;
}

export interface FestivalSummary {
  eventCount: number;
  programCount: number;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  venues: { id: number; name: string; slug: string; neighborhood: string | null }[];
  categories: string[];
}

/**
 * Display item types for the event list
 */
export type DisplayItem =
  | { type: "event"; event: EventWithLocation }
  | { type: "venue-group"; venueId: number; venueName: string; venueSlug: string; neighborhood: string | null; events: EventWithLocation[] }
  | { type: "category-group"; categoryId: string; categoryName: string; events: EventWithLocation[] }
  | { type: "series-group"; seriesId: string; series: SeriesInfo; venueGroups: SeriesVenueGroup[] }
  | { type: "festival-group"; festivalId: string; festival: FestivalInfo; summary: FestivalSummary };

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

export interface GroupDisplayOptions {
  collapseFestivals?: boolean;
  collapseFestivalPrograms?: boolean;
  rollupVenues?: boolean;
  rollupCategories?: boolean;
  sortByTime?: boolean;
  includeLongRunningExhibits?: boolean;
}

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
 * Build a summary for collapsed festival/convention display
 * Derives date range and venues from child events
 */
function buildFestivalSummary(events: EventWithLocation[]): FestivalSummary {
  // Collect all dates to find range
  const dates = events
    .flatMap((e) => [e.start_date, e.end_date])
    .filter((d): d is string => d !== null)
    .sort();

  const startDate = dates[0] || events[0]?.start_date || "";
  const endDate = dates[dates.length - 1] || events[0]?.start_date || "";

  // Calculate time range for the day (ignore all-day events)
  const timeBuckets = events
    .filter((e) => !e.is_all_day)
    .map((e) => ({
      start: e.start_time,
      end: e.end_time || e.start_time,
    }))
    .filter((t): t is { start: string; end: string } => Boolean(t.start && t.end))
    .sort((a, b) => a.start.localeCompare(b.start));

  const startTime = timeBuckets[0]?.start || null;
  const endTime = timeBuckets.length > 0
    ? [...timeBuckets].sort((a, b) => a.end.localeCompare(b.end))[timeBuckets.length - 1]?.end || null
    : null;

  // Count unique programs (series) represented
  const programIds = new Set(
    events.map((e) => e.series_id).filter((id): id is string => Boolean(id))
  );

  // Collect unique venues
  const venueMap = new Map<number, FestivalSummary["venues"][0]>();
  for (const event of events) {
    if (event.venue && !venueMap.has(event.venue.id)) {
      venueMap.set(event.venue.id, {
        id: event.venue.id,
        name: event.venue.name,
        slug: event.venue.slug,
        neighborhood: event.venue.neighborhood,
      });
    }
  }

  // Collect unique categories
  const categories = [...new Set(events.map((e) => e.category_id).filter((c): c is string => c !== null))];

  return {
    eventCount: events.length,
    programCount: programIds.size,
    startDate,
    endDate,
    startTime,
    endTime,
    venues: Array.from(venueMap.values()),
    categories,
  };
}

/**
 * Group events into display items (individual events, venue groups, category groups, series groups)
 * Uses rollup thresholds to combine events from the same venue or category
 * Festival rollups happen first, then series, then venue, then category, then individual events
 */
export function groupEventsForDisplay(
  events: EventWithLocation[],
  options: GroupDisplayOptions = {}
): DisplayItem[] {
  // Filter out events with no start_time (unless all-day).
  // Also hide long-running exhibit-like content from generic event feeds by default.
  const includeLongRunningExhibits = options.includeLongRunningExhibits ?? false;
  const filteredEvents = events.filter((e) => {
    if (!e.start_time && !e.is_all_day) return false;
    if (!includeLongRunningExhibits && isSuppressedFromGeneralEventFeed(e)) return false;
    return true;
  });

  const items: DisplayItem[] = [];
  const usedEventIds = new Set<number>();
  const collapseFestivals = options.collapseFestivals ?? true;
  const collapseFestivalPrograms =
    options.collapseFestivalPrograms ?? collapseFestivals;
  const rollupVenues = options.rollupVenues ?? true;
  const rollupCategories = options.rollupCategories ?? true;
  const sortByTime = options.sortByTime ?? true;

  const eventIndex = new Map<number, number>();
  filteredEvents.forEach((event, index) => {
    eventIndex.set(event.id, index);
  });

  const festivalSortIndex = new Map<string, number>();
  const seriesSortIndex = new Map<string, number>();
  const venueSortIndex = new Map<number, number>();
  const categorySortIndex = new Map<string, number>();

  // FIRST PASS: Group festival programs into a single festival card
  if (collapseFestivals) {
    const festivalGroups = new Map<
      string,
      { festival: FestivalInfo; events: EventWithLocation[]; sortIndex: number }
    >();

    for (const event of filteredEvents) {
      const festival = event.series?.festival;
      if (!festival) continue;

      const index = eventIndex.get(event.id) ?? 0;
      const existing = festivalGroups.get(festival.id);
      if (existing) {
        existing.events.push(event);
        existing.sortIndex = Math.min(existing.sortIndex, index);
      } else {
        festivalGroups.set(festival.id, {
          festival: {
            id: festival.id,
            slug: festival.slug,
            name: festival.name,
            image_url: festival.image_url,
            festival_type: festival.festival_type,
            location: festival.location,
            neighborhood: festival.neighborhood,
          },
          events: [event],
          sortIndex: index,
        });
      }
    }

    for (const [festivalId, group] of festivalGroups) {
      const summary = buildFestivalSummary(group.events);

      items.push({
        type: "festival-group",
        festivalId,
        festival: group.festival,
        summary,
      });
      festivalSortIndex.set(festivalId, group.sortIndex);

      group.events.forEach((e) => usedEventIds.add(e.id));
    }
  }

  // SECOND PASS: Group remaining series events by series_id
  // Series grouping takes priority over venue/category rollups
  const seriesGroups = new Map<string, { events: EventWithLocation[]; sortIndex: number }>();

  for (const event of filteredEvents) {
    if (usedEventIds.has(event.id)) continue;
    if (event.series_id && event.series) {
      if (!collapseFestivalPrograms && event.series.series_type === "festival_program") {
        continue;
      }
      const index = eventIndex.get(event.id) ?? 0;
      const existing = seriesGroups.get(event.series_id);
      if (existing) {
        existing.events.push(event);
        existing.sortIndex = Math.min(existing.sortIndex, index);
      } else {
        seriesGroups.set(event.series_id, { events: [event], sortIndex: index });
      }
    }
  }

  // Create series groups - group by venue within each series
  for (const [seriesId, group] of seriesGroups) {
    const seriesEvents = group.events;
    // Get series info from first event
    const firstEvent = seriesEvents[0];
    const series = firstEvent.series!;
    const seriesGoingCount = seriesEvents.reduce(
      (sum, event) => sum + (event.going_count ?? 0),
      0
    );
    const seriesInterestedCount = seriesEvents.reduce(
      (sum, event) => sum + (event.interested_count ?? 0),
      0
    );
    const seriesRecommendationCount = seriesEvents.reduce(
      (sum, event) => sum + (event.recommendation_count ?? 0),
      0
    );

    // Regular series (film, recurring shows, programs) - expand with showtimes by venue
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
        showtimes: venueEvents.map((e) => ({
          id: e.id,
          time: e.start_time,
          ticket_url: e.ticket_url,
          source_url: e.source_url,
        })),
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
        frequency: series.frequency,
        day_of_week: series.day_of_week,
        rsvp_count: seriesGoingCount > 0 ? seriesGoingCount : undefined,
        interested_count: seriesInterestedCount > 0 ? seriesInterestedCount : undefined,
        recommendation_count: seriesRecommendationCount > 0 ? seriesRecommendationCount : undefined,
      },
      venueGroups,
    });
    seriesSortIndex.set(seriesId, group.sortIndex);

    // Mark all series events as used
    seriesEvents.forEach((e) => usedEventIds.add(e.id));
  }

  // THIRD PASS: Find venue clusters (excluding series events)
  const venueGroups = new Map<number, EventWithLocation[]>();

  for (const event of filteredEvents) {
    if (usedEventIds.has(event.id)) continue;
    if (event.venue?.id) {
      const existing = venueGroups.get(event.venue.id) || [];
      existing.push(event);
      venueGroups.set(event.venue.id, existing);
    }
  }

  // Create venue groups for venues with enough events
  if (rollupVenues) {
    for (const [venueId, venueEvents] of venueGroups) {
      const venue = venueEvents[0].venue!;
      const sortIndex = Math.min(...venueEvents.map((e) => eventIndex.get(e.id) ?? 0));

      if (venueEvents.length >= VENUE_ROLLUP_THRESHOLD) {
        items.push({
          type: "venue-group",
          venueId,
          venueName: venue.name,
          venueSlug: venue.slug,
          neighborhood: venue.neighborhood,
          events: venueEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
        });
        venueSortIndex.set(venueId, sortIndex);
        venueEvents.forEach((e) => usedEventIds.add(e.id));
      }
    }
  }

  // FOURTH PASS: Find category clusters (only for specific categories)
  const categoryGroups = new Map<string, EventWithLocation[]>();
  for (const event of filteredEvents) {
    if (usedEventIds.has(event.id)) continue;
    if (event.category_id && ROLLUP_CATEGORIES.includes(event.category_id)) {
      const existing = categoryGroups.get(event.category_id) || [];
      existing.push(event);
      categoryGroups.set(event.category_id, existing);
    }
  }

  // Create category groups
  if (rollupCategories) {
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
        categorySortIndex.set(
          categoryId,
          Math.min(...catEvents.map((e) => eventIndex.get(e.id) ?? 0))
        );
        catEvents.forEach((e) => usedEventIds.add(e.id));
      }
    }
  }

  // FIFTH PASS: Add remaining events as individual items
  for (const event of filteredEvents) {
    if (!usedEventIds.has(event.id)) {
      items.push({ type: "event", event });
    }
  }

  if (sortByTime) {
    // Sort by earliest start time
    items.sort((a, b) => {
      const getFirstTime = (item: DisplayItem): string => {
        if (item.type === "event") return item.event.start_time || "00:00";
        if (item.type === "series-group") return item.venueGroups[0]?.showtimes[0]?.time || "00:00";
        if (item.type === "festival-group") return "00:00"; // Festivals sort at start of day
        if (item.type === "venue-group" || item.type === "category-group") {
          return item.events[0]?.start_time || "00:00";
        }
        return "00:00";
      };
      return getFirstTime(a).localeCompare(getFirstTime(b));
    });
  } else {
    const getSortIndex = (item: DisplayItem): number => {
      if (item.type === "event") return eventIndex.get(item.event.id) ?? 0;
      if (item.type === "festival-group") return festivalSortIndex.get(item.festivalId) ?? 0;
      if (item.type === "series-group") return seriesSortIndex.get(item.seriesId) ?? 0;
      if (item.type === "venue-group") return venueSortIndex.get(item.venueId) ?? 0;
      if (item.type === "category-group") return categorySortIndex.get(item.categoryId) ?? 0;
      return 0;
    };
    items.sort((a, b) => getSortIndex(a) - getSortIndex(b));
  }

  return items;
}

/**
 * Get the first time for a display item (used for sorting/grouping)
 */
function getFirstTimeForItem(item: DisplayItem): string | null {
  if (item.type === "event") return item.event.start_time;
  if (item.type === "series-group") return item.venueGroups[0]?.showtimes[0]?.time || null;
  if (item.type === "festival-group") return null; // Festivals span multiple times, default to morning
  if (item.type === "venue-group" || item.type === "category-group") {
    return item.events[0]?.start_time || null;
  }
  return null;
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
 * Get the effective display date for any item with a date range.
 * Items that started in the past but are still ongoing display as "today".
 */
export function getEffectiveDate(startDate: string, endDate?: string | null): string {
  const today = format(new Date(), "yyyy-MM-dd");
  if (startDate < today && endDate && endDate >= today) {
    return today;
  }
  return startDate;
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: EventWithLocation[]): Record<string, EventWithLocation[]> {
  return events.reduce(
    (acc, event) => {
      const date = getEffectiveDate(event.start_date, event.end_date);
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

/**
 * Create a DisplayItem for a standalone festival (one with no linked events).
 * Used to inject festivals into the event list alongside real events.
 */
export function createStandaloneFestivalItem(festival: Festival): DisplayItem {
  return {
    type: "festival-group",
    festivalId: festival.id,
    festival: {
      id: festival.id,
      slug: festival.slug,
      name: festival.name,
      image_url: festival.image_url,
      festival_type: festival.festival_type ?? null,
      location: festival.location,
      neighborhood: festival.neighborhood,
      free: festival.free,
    },
    summary: {
      eventCount: 0,
      programCount: 0,
      startDate: festival.announced_start!,
      endDate: festival.announced_end || festival.announced_start!,
      startTime: null,
      endTime: null,
      venues: [],
      categories: festival.categories || [],
    },
  };
}
