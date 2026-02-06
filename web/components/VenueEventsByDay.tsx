"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isTomorrow,
  addDays,
  startOfDay,
} from "date-fns";
import { formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

// Common event type that works with both EventDetailView and VenueDetailView
export type VenueEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_free?: boolean;
  price_min?: number | null;
  category?: string | null;
  venue?: { id: number; name: string; slug: string } | null;
};

interface VenueEventsByDayProps {
  events: VenueEvent[];
  onEventClick?: (eventId: number) => void; // For client-side navigation
  getEventHref?: (eventId: number) => string; // For SSR/Link-based navigation
  maxDates?: number; // Limit visible date tabs (default: 7)
  showDatePicker?: boolean; // Show "jump to date" option (default: false)
  compact?: boolean; // Smaller variant for detail pages (default: false)
}

export default function VenueEventsByDay({
  events,
  onEventClick,
  getEventHref,
  maxDates = 7,
  showDatePicker = false,
  compact = false,
}: VenueEventsByDayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDatePickerInput, setShowDatePickerInput] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState("");

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, VenueEvent[]>();
    for (const event of events) {
      const dateKey = event.start_date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }
    // Sort by date
    return new Map(
      [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
  }, [events]);

  // Get unique dates for the selector
  const availableDates = useMemo(() => {
    return [...eventsByDate.keys()].map((dateStr) => parseISO(dateStr));
  }, [eventsByDate]);

  // Selected date state
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return availableDates[0] || new Date();
  });

  // Get events for selected date
  const selectedEvents = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // Format date label
  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tmrw";
    return format(date, "EEE");
  };

  // Handle date picker change
  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDatePickerValue(value);
    if (value) {
      const pickedDate = parseISO(value);
      // Find closest date with events
      const closestDate = availableDates.find(
        (d) => startOfDay(d) >= startOfDay(pickedDate)
      );
      if (closestDate) {
        setSelectedDate(closestDate);
        // Scroll to the selected date
        setTimeout(() => {
          const index = availableDates.findIndex((d) =>
            isSameDay(d, closestDate)
          );
          if (scrollRef.current && index >= 0) {
            const buttons = scrollRef.current.querySelectorAll("button");
            buttons[index]?.scrollIntoView({
              behavior: "smooth",
              inline: "center",
              block: "nearest",
            });
          }
        }, 100);
      }
    }
    setShowDatePickerInput(false);
  };

  // Don't render if no events
  if (events.length === 0) {
    return null;
  }

  // Single date - simplified view
  if (availableDates.length === 1) {
    return (
      <div className="space-y-2">
        {selectedEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onClick={onEventClick ? () => onEventClick(event.id) : undefined}
            href={getEventHref ? getEventHref(event.id) : undefined}
            compact={compact}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Date Selector */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3"
        >
          {availableDates.slice(0, maxDates).map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const eventsOnDay =
              eventsByDate.get(format(date, "yyyy-MM-dd"))?.length || 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 flex flex-col items-center rounded-lg border transition-all ${
                  compact ? "px-2 py-1.5" : "px-3 py-2"
                } ${
                  isSelected
                    ? "bg-[var(--coral)]/20 border-[var(--coral)]/50 text-[var(--coral)]"
                    : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/30"
                }`}
              >
                <span
                  className={`font-mono uppercase tracking-wider ${
                    compact ? "text-[0.55rem]" : "text-[0.65rem]"
                  }`}
                >
                  {formatDateLabel(date)}
                </span>
                <span
                  className={`font-mono font-bold leading-tight ${
                    compact ? "text-sm" : "text-lg"
                  }`}
                >
                  {format(date, "d")}
                </span>
                <span
                  className={`font-mono text-[var(--muted)] uppercase ${
                    compact ? "text-[0.45rem]" : "text-[0.55rem]"
                  }`}
                >
                  {format(date, "MMM")}
                </span>
                {eventsOnDay > 1 && (
                  <span
                    className={`mt-0.5 px-1 py-0.5 bg-[var(--twilight)] rounded font-mono ${
                      compact ? "text-[0.45rem]" : "text-[0.5rem]"
                    }`}
                  >
                    {eventsOnDay}
                  </span>
                )}
              </button>
            );
          })}

          {/* Show more indicator if there are more dates */}
          {availableDates.length > maxDates && !showDatePicker && (
            <div className="flex-shrink-0 flex items-center px-2 text-[var(--muted)]">
              <span className="font-mono text-[0.6rem]">
                +{availableDates.length - maxDates}
              </span>
            </div>
          )}

          {/* Date Picker Button */}
          {showDatePicker && (
            <div className="flex-shrink-0 relative">
              <button
                onClick={() => setShowDatePickerInput(!showDatePickerInput)}
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)]/50 hover:text-[var(--coral)] transition-all ${
                  compact
                    ? "px-2 py-1.5 min-h-[52px]"
                    : "px-3 py-2 min-h-[72px]"
                }`}
              >
                <svg
                  className={compact ? "w-4 h-4" : "w-5 h-5"}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span
                  className={`font-mono mt-0.5 uppercase ${
                    compact ? "text-[0.4rem]" : "text-[0.5rem]"
                  }`}
                >
                  Jump
                </span>
              </button>
              {showDatePickerInput && (
                <input
                  type="date"
                  value={datePickerValue}
                  onChange={handleDatePickerChange}
                  min={format(availableDates[0] || new Date(), "yyyy-MM-dd")}
                  max={format(
                    availableDates[availableDates.length - 1] ||
                      addDays(new Date(), 90),
                    "yyyy-MM-dd"
                  )}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  onBlur={() => setShowDatePickerInput(false)}
                  autoFocus
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Events for Selected Date */}
      <div className="space-y-2">
        {selectedEvents.length === 0 ? (
          <div className="text-center py-6 text-[var(--muted)] font-mono text-sm">
            No events on this date
          </div>
        ) : (
          selectedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={onEventClick ? () => onEventClick(event.id) : undefined}
              href={getEventHref ? getEventHref(event.id) : undefined}
              compact={compact}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Event card component
function EventCard({
  event,
  onClick,
  href,
  compact,
}: {
  event: VenueEvent;
  onClick?: () => void;
  href?: string;
  compact: boolean;
}) {
  const { time, period } = formatTimeSplit(event.start_time);
  const accentColor = event.category ? getCategoryColor(event.category) : "var(--neon-magenta)";
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");

  const cardContent = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {event.category && (
            <span
              className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded bg-accent-20"
            >
              <CategoryIcon type={event.category} size={10} glow="subtle" />
            </span>
          )}
          <h3
            className={`text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors ${
              compact ? "text-sm" : ""
            }`}
          >
            {event.title}
          </h3>
        </div>
        <div
          className={`flex items-center gap-2 mt-1 text-[var(--muted)] ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {event.start_time && (
            <span className="font-mono">
              {time}
              {period}
            </span>
          )}
          {event.is_free ? (
            <span className="px-1.5 py-0.5 rounded border bg-[var(--neon-green)]/15 text-[var(--neon-green)] border-[var(--neon-green)]/25 font-mono text-[0.55rem]">
              Free
            </span>
          ) : event.price_min ? (
            <span>${event.price_min}+</span>
          ) : null}
        </div>
      </div>
      <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </span>
    </div>
  );

  const cardClassName = `block w-full text-left border border-[var(--twilight)] rounded-lg bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group ${
    compact ? "p-3" : "p-4"
  } ${accentClass?.className ?? ""} ${event.category ? "border-l-[3px] border-l-[var(--accent-color)]" : ""}`;

  if (href) {
    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <Link href={href} className={cardClassName}>
          {cardContent}
        </Link>
      </>
    );
  }

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <button onClick={onClick} className={cardClassName}>
        {cardContent}
      </button>
    </>
  );
}
