"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isTomorrow,
} from "date-fns";
import { formatTimeSplit } from "@/lib/formats";
import { getEffectiveDate } from "@/lib/event-grouping";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { InfoCard, SectionHeader } from "@/components/detail";
import VenueEventsByDay, {
  VenueEventCard,
  type VenueEvent,
} from "@/components/VenueEventsByDay";

// Extended event type that includes series info from the joined query
export type ShowtimeEvent = VenueEvent & {
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
  } | null;
  image_url?: string | null;
};

interface VenueShowtimesProps {
  events: ShowtimeEvent[];
  portalSlug: string;
  venueType?: string | null;
  accentColor?: string;
  title?: string;
  onEventClick?: (eventId: number) => void;
  /** When true, renders without the InfoCard wrapper (caller provides context). */
  bare?: boolean;
}

// Venue types that tend to have many repeat screenings/shows
const HIGH_EVENT_VENUE_TYPES = new Set([
  "cinema",
  "theater",
  "music_venue",
  "stadium",
  "amphitheater",
  "nightclub",
]);

function isHighEventVenue(type: string | null | undefined): boolean {
  return type ? HIGH_EVENT_VENUE_TYPES.has(type) : false;
}

export default function VenueShowtimes({
  events,
  portalSlug,
  venueType,
  accentColor,
  title,
  onEventClick,
  bare,
}: VenueShowtimesProps) {
  if (events.length === 0) return null;

  // Mode B: Simple list for venues with few events
  const useShowtimeMode = events.length > 8 && isHighEventVenue(venueType);

  const header = (
    <SectionHeader
      title={title || (useShowtimeMode ? "Showtimes" : "Upcoming Events")}
      count={events.length}
      variant="inline"
    />
  );

  const content = useShowtimeMode ? (
    <ShowtimesByDate events={events} portalSlug={portalSlug} onEventClick={onEventClick} />
  ) : (
    <VenueEventsByDay
      events={events}
      portalSlug={portalSlug}
      onEventClick={onEventClick}
      compact
      maxDates={7}
    />
  );

  if (bare) {
    return (
      <>
        {header}
        {content}
      </>
    );
  }

  return (
    <InfoCard accentColor={accentColor}>
      {header}
      {content}
    </InfoCard>
  );
}

// ============================================================================
// Mode A: Date tabs + series-grouped showtimes
// ============================================================================

// Normalize film title — strip year/format suffixes for fuzzy grouping
const normalizeFilmTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/\s*\(\d{4}\)\s*$/, "") // strip (2024) suffix
    .replace(/\s*-\s*(imax|3d|dolby|atmos|4dx|dbox|screenx)\s*$/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function ShowtimesByDate({
  events,
  portalSlug,
  onEventClick,
}: {
  events: ShowtimeEvent[];
  portalSlug: string;
  onEventClick?: (eventId: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group events by effective date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, ShowtimeEvent[]>();
    for (const event of events) {
      const dateKey = getEffectiveDate(event.start_date, event.end_date);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }
    return new Map(
      [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
  }, [events]);

  const availableDates = useMemo(() => {
    return [...eventsByDate.keys()].map((dateStr) => parseISO(dateStr));
  }, [eventsByDate]);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return availableDates[0] || new Date();
  });

  const selectedEvents = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // Group selected events by series_id or fuzzy title match
  const { seriesGroups, standaloneEvents } = useMemo(() => {
    const seriesMap = new Map<
      string,
      { series: NonNullable<ShowtimeEvent["series"]>; events: ShowtimeEvent[] }
    >();
    const standalone: ShowtimeEvent[] = [];

    for (const event of selectedEvents) {
      // Use series_id if available, otherwise group by normalized title
      const groupKey = event.series_id
        ? event.series_id
        : `title:${normalizeFilmTitle(event.title)}`;

      if (event.series_id && event.series) {
        const existing = seriesMap.get(groupKey);
        if (existing) {
          existing.events.push(event);
        } else {
          seriesMap.set(groupKey, {
            series: event.series,
            events: [event],
          });
        }
      } else if (groupKey.startsWith("title:")) {
        // Fuzzy title grouping — create synthetic series from title
        const existing = seriesMap.get(groupKey);
        if (existing) {
          existing.events.push(event);
        } else {
          // Only group if this is a showtime-style venue (will have multiple)
          // We'll check after gathering all events for this title key
          seriesMap.set(groupKey, {
            series: {
              id: groupKey,
              slug: "",
              title: event.title,
              series_type: "film",
              image_url: event.image_url || null,
            },
            events: [event],
          });
        }
      } else {
        standalone.push(event);
      }
    }

    // Title-grouped entries with only 1 event aren't useful as groups — make them standalone
    const finalGroups: typeof seriesMap = new Map();
    for (const [key, group] of seriesMap) {
      if (key.startsWith("title:") && group.events.length === 1) {
        standalone.push(group.events[0]);
      } else {
        finalGroups.set(key, group);
      }
    }

    // Sort events within each series by time
    for (const group of finalGroups.values()) {
      group.events.sort((a, b) =>
        (a.start_time || "").localeCompare(b.start_time || "")
      );
    }

    // Sort series groups by earliest showtime
    const sorted = [...finalGroups.values()].sort((a, b) => {
      const aTime = a.events[0]?.start_time || "";
      const bTime = b.events[0]?.start_time || "";
      return aTime.localeCompare(bTime);
    });

    return { seriesGroups: sorted, standaloneEvents: standalone };
  }, [selectedEvents]);

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tmrw";
    return format(date, "EEE");
  };

  return (
    <div className="space-y-3">
      {/* Date Selector */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3"
        >
          {availableDates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const eventsOnDay =
              eventsByDate.get(format(date, "yyyy-MM-dd"))?.length || 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 flex flex-col items-center rounded-lg border transition-all px-2 py-1.5 ${
                  isSelected
                    ? "bg-[var(--coral)]/20 border-[var(--coral)]/50 text-[var(--coral)]"
                    : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/30"
                }`}
              >
                <span className="font-mono uppercase tracking-wider text-2xs">
                  {formatDateLabel(date)}
                </span>
                <span className="font-mono font-bold leading-tight text-sm">
                  {format(date, "d")}
                </span>
                <span className="font-mono text-[var(--muted)] uppercase text-2xs">
                  {format(date, "MMM")}
                </span>
                {eventsOnDay > 1 && (
                  <span className="mt-0.5 px-1 py-0.5 bg-[var(--twilight)] rounded font-mono text-2xs">
                    {eventsOnDay}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouped showtimes for selected date */}
      <div className="space-y-2">
        {selectedEvents.length === 0 ? (
          <div className="text-center py-6 text-[var(--muted)] font-mono text-sm">
            No events on this date
          </div>
        ) : (
          <>
            {/* Series showtime rows */}
            {seriesGroups.map(({ series, events: seriesEvents }) => (
              <SeriesShowtimeRow
                key={series.id}
                series={series}
                events={seriesEvents}
                portalSlug={portalSlug}
                onEventClick={onEventClick}
              />
            ))}

            {/* Standalone events (no series) */}
            {standaloneEvents.map((event) => (
              <VenueEventCard
                key={event.id}
                event={event}
                onClick={onEventClick ? () => onEventClick(event.id) : undefined}
                href={onEventClick ? undefined : `/${portalSlug}/events/${event.id}`}
                compact
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Series Showtime Row — poster + title + time chips
// ============================================================================

export function SeriesShowtimeRow({
  series,
  events,
  portalSlug,
  onEventClick,
}: {
  series: NonNullable<ShowtimeEvent["series"]>;
  events: ShowtimeEvent[];
  portalSlug: string;
  onEventClick?: (eventId: number) => void;
}) {
  const seriesHref = `/${portalSlug}?series=${series.slug}`;
  const posterUrl = series.image_url || events[0]?.image_url;
  const accentColor = getCategoryColor(
    series.series_type === "film" ? "film" : "performing-arts"
  );

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] group"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      {/* Poster thumbnail */}
      <Link href={seriesHref} scroll={false} className="flex-shrink-0">
        {posterUrl ? (
          <div className="w-12 h-16 rounded overflow-hidden bg-[var(--twilight)] relative">
            <Image
              src={posterUrl}
              alt={series.title}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-16 rounded bg-[var(--twilight)] flex items-center justify-center">
            <CategoryIcon
              type={series.series_type === "film" ? "film" : "performing-arts"}
              size={20}
            />
          </div>
        )}
      </Link>

      {/* Title + time chips */}
      <div className="flex-1 min-w-0">
        <Link
          href={seriesHref}
          scroll={false}
          className="block mb-2 group/title"
        >
          <h3 className="text-[var(--cream)] font-medium text-sm leading-tight line-clamp-2 group-hover/title:text-[var(--coral)] transition-colors">
            {series.title}
          </h3>
          {series.series_type === "film" && (
            <span className="text-xs font-mono uppercase text-[var(--muted)] tracking-wider">
              Film
            </span>
          )}
        </Link>

        {/* Time chips */}
        <div className="flex flex-wrap gap-1.5">
          {events.map((event) => {
            const { time, period } = formatTimeSplit(event.start_time);
            const chipClass = "inline-flex items-baseline gap-0.5 font-mono text-xs px-2.5 py-1 rounded-md bg-[var(--twilight)] hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] text-[var(--soft)] transition-colors";
            return onEventClick ? (
              <button
                key={event.id}
                onClick={() => onEventClick(event.id)}
                className={chipClass}
              >
                <span className="font-semibold">{time}</span>
                {period && (
                  <span className="text-xs text-[var(--muted)]">
                    {period}
                  </span>
                )}
              </button>
            ) : (
              <Link
                key={event.id}
                href={`/${portalSlug}/events/${event.id}`}
                className={chipClass}
              >
                <span className="font-semibold">{time}</span>
                {period && (
                  <span className="text-xs text-[var(--muted)]">
                    {period}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
