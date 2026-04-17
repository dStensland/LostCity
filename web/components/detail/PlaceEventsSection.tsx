"use client";

import React, { useState, useRef, useMemo } from "react";
import { format, parseISO, isSameDay, isToday, isTomorrow, addDays, startOfDay } from "date-fns";
import { getEffectiveDate } from "@/lib/event-grouping";
import { PlaceEventCard } from "@/components/PlaceEventsByDay";
import { CalendarBlank } from "@phosphor-icons/react";

type UpcomingEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  start_time: string | null;
  is_free?: boolean;
  price_min: number | null;
  category: string | null;
  artists?: {
    name: string;
    billing_order?: number | null;
    is_headliner?: boolean;
  }[];
  lineup?: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

interface PlaceEventsSectionProps {
  venueName: string;
  events: UpcomingEvent[];
  onEventClick: (id: number) => void;
}

export default function PlaceEventsSection({
  venueName,
  events,
  onEventClick,
}: PlaceEventsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState("");

  // Group events by effective date (ongoing multi-day events show as Today)
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, UpcomingEvent[]>();
    for (const event of events) {
      const dateKey = getEffectiveDate(event.start_date, event.end_date);
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
    if (isTomorrow(date)) return "Tomorrow";
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
          const index = availableDates.findIndex((d) => isSameDay(d, closestDate));
          if (scrollRef.current && index >= 0) {
            const buttons = scrollRef.current.querySelectorAll("button");
            buttons[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
          }
        }, 100);
      }
    }
    setShowDatePicker(false);
  };

  return (
    <div>
      {/* Date Selector — compact pill strip */}
      <div className="relative mb-4">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4"
        >
          {availableDates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const eventsOnDay = eventsByDate.get(format(date, "yyyy-MM-dd"))?.length || 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={[
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs tracking-wide transition-all active:scale-95 border",
                  isSelected
                    ? "bg-[var(--coral)]/15 border-[var(--coral)]/40 text-[var(--coral)] font-semibold"
                    : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/30 hover:bg-white/[0.02]",
                ].join(" ")}
              >
                <span>{formatDateLabel(date)}</span>
                <span className="tabular-nums font-semibold">{format(date, "d")}</span>
                {eventsOnDay > 1 && (
                  <span className={[
                    "text-2xs tabular-nums",
                    isSelected ? "opacity-70" : "opacity-40",
                  ].join(" ")}>
                    {eventsOnDay}
                  </span>
                )}
              </button>
            );
          })}

          {/* Jump to date */}
          <div className="shrink-0 relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)]/30 hover:text-[var(--coral)] transition-all font-mono text-xs"
            >
              <CalendarBlank size={14} weight="bold" aria-hidden="true" />
            </button>
            {showDatePicker && (
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
                aria-label="Jump to date"
                onBlur={() => setShowDatePicker(false)}
                autoFocus
              />
            )}
          </div>
        </div>
      </div>

      {/* Events for Selected Date */}
      <div className="space-y-2">
        {selectedEvents.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] font-mono text-sm">
            No events on this date
          </div>
        ) : (
          selectedEvents.map((event) => (
            <PlaceEventCard
              key={event.id}
              event={event}
              onClick={() => onEventClick(event.id)}
              compact={false}
            />
          ))
        )}
      </div>
    </div>
  );
}
