"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
} from "date-fns";
import { getCategoryColor } from "./CategoryIcon";
import CategoryIcon from "./CategoryIcon";
import { formatTimeSplit } from "@/lib/formats";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useCalendarEvents, type CalendarEvent, type CalendarSummary } from "@/lib/hooks/useCalendarEvents";

interface DayData {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

// Get reflection color class based on category
function getReflectionClass(category: string | null): string {
  if (!category) return "";
  const reflectionMap: Record<string, string> = {
    music: "reflect-music",
    comedy: "reflect-comedy",
    art: "reflect-art",
    theater: "reflect-theater",
    film: "reflect-film",
    community: "reflect-community",
    food_drink: "reflect-food",
    food: "reflect-food",
    sports: "reflect-sports",
    fitness: "reflect-fitness",
    nightlife: "reflect-nightlife",
    family: "reflect-family",
  };
  return reflectionMap[category] || "";
}

interface Props {
  portalId?: string;
  portalSlug?: string;
  portalExclusive?: boolean;
}

// Category priority for showing dots (most colorful/interesting first)
const CATEGORY_PRIORITY = [
  "music", "art", "comedy", "theater", "film", "nightlife",
  "food_drink", "sports", "fitness", "community", "family", "other"
];

// Always render 6 rows (42 days) to prevent layout shift
const CALENDAR_ROWS = 6;
const CALENDAR_DAYS = CALENDAR_ROWS * 7;

export default function CalendarView({ portalId, portalSlug = DEFAULT_PORTAL_SLUG, portalExclusive }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Use the new React Query hook for calendar events
  const { eventsByDate, summary, isLoading: loading, isRefetching } = useCalendarEvents({
    month: currentMonth.getMonth() + 1,
    year: currentMonth.getFullYear(),
    portalId,
    portalExclusive,
  });

  // Track if initial load is done (for showing subtle loading indicator)
  const initialLoadDone = eventsByDate.size > 0 || !loading;

  // Generate calendar grid - always 6 rows for stable layout
  const calendarDays = useMemo((): DayData[] => {
    const monthStart = startOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const today = new Date();

    const days: DayData[] = [];
    let day = calStart;

    // Always generate exactly 42 days (6 rows)
    for (let i = 0; i < CALENDAR_DAYS; i++) {
      const dateKey = format(day, "yyyy-MM-dd");
      days.push({
        date: new Date(day),
        events: eventsByDate.get(dateKey) || [],
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isToday(day),
        isPast: isBefore(day, today) && !isToday(day),
      });
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth, eventsByDate]);

  // Selected day's events (with deduplication for safety)
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const dayEvents = eventsByDate.get(dateKey) || [];
    // Deduplicate by event ID
    const seen = new Set<number>();
    return dayEvents.filter(event => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  }, [selectedDate, eventsByDate]);

  // Navigation handlers - immediate updates, CSS handles transitions
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((m) => subMonths(m, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((m) => addMonths(m, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }, []);

  // Get unique categories for a day (for color dots)
  const getDayCategories = useCallback((dayEvents: CalendarEvent[]) => {
    const categories = new Set<string>();
    dayEvents.forEach((e) => {
      if (e.category) categories.add(e.category);
    });
    // Sort by priority and take top 4
    return CATEGORY_PRIORITY.filter((c) => categories.has(c)).slice(0, 4);
  }, []);

  // Calculate event density for heat map effect
  const maxEventsInDay = useMemo(() => {
    let max = 0;
    calendarDays.forEach((d) => {
      if (d.events.length > max) max = d.events.length;
    });
    return max || 1;
  }, [calendarDays]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-2xl font-bold text-[var(--cream)]">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          {/* Subtle loading indicator after initial load */}
          {(loading || isRefetching) && initialLoadDone && (
            <span className="w-4 h-4 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin" />
          )}
          {!isSameMonth(currentMonth, new Date()) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 rounded-full font-mono text-xs font-medium bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-lg hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar Grid */}
        <div className="relative">
          {/* Week day headers */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2 text-center font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const isSelected = selectedDate && isSameDay(day.date, selectedDate);
              const hasEvents = day.events.length > 0;
              const categories = getDayCategories(day.events);
              const density = day.events.length / maxEventsInDay;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day.date)}
                  disabled={!day.isCurrentMonth}
                  className={`
                    relative aspect-square p-1 rounded-lg border transition-all duration-200
                    ${day.isCurrentMonth ? "hover:border-[var(--coral)]/50 hover:scale-[1.02]" : "opacity-30 cursor-default"}
                    ${isSelected
                      ? "border-[var(--coral)] bg-[var(--coral)]/15 shadow-[0_0_15px_rgba(232,145,45,0.2)]"
                      : "border-[var(--twilight)]/50 hover:bg-[var(--twilight)]/30"
                    }
                    ${day.isToday ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--void)]" : ""}
                  `}
                  style={{
                    backgroundColor: hasEvents && day.isCurrentMonth && !isSelected
                      ? `rgba(var(--coral-rgb, 255, 107, 107), ${density * 0.15})`
                      : undefined,
                  }}
                >
                  {/* Day number */}
                  <span
                    className={`
                      absolute top-1 left-1.5 font-mono text-sm font-medium
                      ${day.isToday ? "text-[var(--gold)]" : ""}
                      ${isSelected ? "text-[var(--coral)]" : ""}
                      ${!day.isToday && !isSelected ? (day.isPast ? "text-[var(--muted)]/60" : "text-[var(--cream)]") : ""}
                    `}
                  >
                    {format(day.date, "d")}
                  </span>

                  {/* Event count badge */}
                  {hasEvents && day.isCurrentMonth && (
                    <span className="absolute top-1 right-1.5 font-mono text-[0.6rem] font-bold text-[var(--muted)]">
                      {day.events.length}
                    </span>
                  )}

                  {/* Category color dots */}
                  {categories.length > 0 && day.isCurrentMonth && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {categories.map((cat) => (
                        <span
                          key={cat}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: getCategoryColor(cat) || "var(--muted)" }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.65rem] text-[var(--muted)]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-[var(--gold)]" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[var(--coral)]/20 border border-[var(--coral)]" />
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[var(--coral)]/15" />
              <span>Has events</span>
            </div>
          </div>
        </div>

        {/* Selected Day Detail */}
        <div className="lg:border-l lg:border-[var(--twilight)]/50 lg:pl-6">
          {selectedDate ? (
            <div>
              {/* Date header */}
              <div className="mb-4">
                <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  {format(selectedDate, "EEEE")}
                </div>
                <div className="font-mono text-xl font-bold text-[var(--cream)]">
                  {format(selectedDate, "MMMM d, yyyy")}
                </div>
                {isToday(selectedDate) && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[var(--gold)] text-[var(--void)] font-mono text-[0.6rem] font-medium">
                    TODAY
                  </span>
                )}
              </div>

              {/* Events list */}
              {loading && !initialLoadDone ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--card-bg)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-12 rounded skeleton-shimmer" />
                        <div className="h-4 w-10 rounded-full skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3.5 h-3.5 rounded skeleton-shimmer" />
                        <div className="h-4 w-3/4 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
                      </div>
                      <div className="h-3 w-1/2 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
                    </div>
                  ))}
                </div>
              ) : selectedDayEvents.length > 0 ? (
                <div className="space-y-2 max-h-[60vh] min-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                  {selectedDayEvents.map((event) => {
                    const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
                    const categoryColor = event.category ? getCategoryColor(event.category) : null;
                    const reflectionClass = getReflectionClass(event.category);

                    return (
                      <Link
                        key={event.id}
                        href={`/${portalSlug}/events/${event.id}`}
                        className={`block p-3 rounded-lg border border-[var(--twilight)] card-atmospheric ${reflectionClass} group`}
                        style={{
                          borderLeftWidth: categoryColor ? "3px" : undefined,
                          borderLeftColor: categoryColor || undefined,
                          backgroundColor: "var(--card-bg)",
                          "--glow-color": categoryColor || "var(--coral)",
                          "--reflection-color": categoryColor ? `color-mix(in srgb, ${categoryColor} 15%, transparent)` : undefined,
                        } as React.CSSProperties}
                      >
                        {/* Time */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-[var(--muted)]">
                            {time}
                            {period && <span className="text-[0.6rem] ml-0.5 opacity-60">{period}</span>}
                          </span>
                          {event.is_free && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-mono text-[0.55rem] font-medium">
                              FREE
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div className="flex items-center gap-2">
                          {event.category && (
                            <CategoryIcon type={event.category} size={14} className="flex-shrink-0 opacity-60" />
                          )}
                          <span className="text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors line-clamp-2">
                            {event.title}
                          </span>
                        </div>

                        {/* Venue */}
                        {event.venue && (
                          <div className="mt-1 text-xs text-[var(--muted)] truncate">
                            {event.venue.name}
                            {event.venue.neighborhood && (
                              <span className="opacity-60"> · {event.venue.neighborhood}</span>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-[var(--muted)] text-sm">No events on this day</p>
                  <p className="text-[var(--muted)]/60 text-xs mt-1">
                    {isBefore(selectedDate, new Date()) && !isToday(selectedDate)
                      ? "This day has passed"
                      : "Check back later for updates"}
                  </p>
                </div>
              )}

              {/* View all link */}
              {selectedDayEvents.length > 0 && (
                <Link
                  href={`/${portalSlug}?view=events&date_start=${format(selectedDate, "yyyy-MM-dd")}&date_end=${format(selectedDate, "yyyy-MM-dd")}`}
                  className="block mt-4 text-center py-2 rounded-lg border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--coral)]/50 transition-colors font-mono text-xs"
                >
                  View all {selectedDayEvents.length} events in list view →
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--muted)]">
              <p>Select a day to see events</p>
            </div>
          )}
        </div>
      </div>

      {/* Month stats */}
      <div className="mt-6 pt-4 border-t border-[var(--twilight)]/50">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <div className="font-mono text-xs">
            <span className="text-[var(--cream)] font-medium">{summary.totalEvents}</span> events this month
            <span className="ml-2 opacity-60">({summary.daysWithEvents} days)</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {CATEGORY_PRIORITY.slice(0, 6).map((cat) => {
              const count = summary.categoryCounts[cat] || 0;
              if (count === 0) return null;
              return (
                <div key={cat} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getCategoryColor(cat) || "var(--muted)" }}
                  />
                  <span className="font-mono">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
