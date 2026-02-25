"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
import CategoryIcon from "./CategoryIcon";
import { decodeHtmlEntities, formatCompactCount, formatTimeSplit } from "@/lib/formats";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useCalendarEvents, type CalendarEvent } from "@/lib/hooks/useCalendarEvents";

interface DayData {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

interface Props {
  portalId?: string;
  portalSlug?: string;
  portalExclusive?: boolean;
  fullBleed?: boolean;
}

// Category priority for showing dots (most colorful/interesting first)
const CATEGORY_PRIORITY = [
  "music", "art", "comedy", "theater", "film", "nightlife",
  "food_drink", "sports", "fitness", "community", "family", "other"
];

// Genre-specific colors for film events
const FILM_GENRE_COLORS: Record<string, string> = {
  horror: "#ef4444",
  comedy: "#facc15",
  drama: "#818cf8",
  documentary: "#6ee7b7",
  thriller: "#f97316",
  "sci-fi": "#22d3ee",
  action: "#f87171",
  animation: "#c084fc",
  romance: "#fb7185",
  classic: "#d4d4d8",
  foreign: "#a78bfa",
  indie: "#34d399",
};

// Build a full 6-week grid for stable date math; UI can render a trimmed subset.
const CALENDAR_ROWS = 6;
const CALENDAR_DAYS = CALENDAR_ROWS * 7;
const DESKTOP_DENSITY_TUNING = {
  denseListPercentile: 0.65,
  highCellPercentile: 0.75,
  ultraDenseListPercentile: 0.9,
  ultraCellPercentile: 0.95,
  minDenseListThreshold: 10,
  minHighCellThreshold: 12,
  minUltraDenseGap: 8,
  minUltraCellGap: 8,
} as const;

function getPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const bounded = Math.min(1, Math.max(0, percentile));
  const index = (sortedValues.length - 1) * bounded;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export default function CalendarView({
  portalId,
  portalSlug = DEFAULT_PORTAL_SLUG,
  portalExclusive,
  fullBleed = false,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const dayButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const keyboardNavRef = useRef(false);

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
  const activeDate = hoveredDate ?? selectedDate;
  const activeDayEvents = useMemo(() => {
    if (!activeDate) return [];
    const dateKey = format(activeDate, "yyyy-MM-dd");
    const dayEvents = eventsByDate.get(dateKey) || [];
    // Deduplicate by event ID
    const seen = new Set<number>();
    return dayEvents.filter(event => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  }, [activeDate, eventsByDate]);

  // Render only the rows needed for the active month to avoid large empty blocks.
  const visibleCalendarDays = useMemo(() => {
    const lastCurrentMonthIndex = calendarDays.reduce(
      (last, day, idx) => (day.isCurrentMonth ? idx : last),
      -1
    );
    if (lastCurrentMonthIndex < 0) return calendarDays;
    const visibleCount = Math.max(28, Math.ceil((lastCurrentMonthIndex + 1) / 7) * 7);
    return calendarDays.slice(0, visibleCount);
  }, [calendarDays]);

  const selectedIndex = useMemo(() => {
    if (!selectedDate) return 0;
    const idx = visibleCalendarDays.findIndex((day) => isSameDay(day.date, selectedDate));
    return idx >= 0 ? idx : 0;
  }, [selectedDate, visibleCalendarDays]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentMonth(date);
    setHoveredDate(null);
  }, []);

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
    setHoveredDate(null);
  }, []);

  useEffect(() => {
    if (!keyboardNavRef.current) return;
    const idx = visibleCalendarDays.findIndex((day) => selectedDate && isSameDay(day.date, selectedDate));
    if (idx >= 0) {
      dayButtonRefs.current[idx]?.focus();
    }
    keyboardNavRef.current = false;
  }, [selectedDate, visibleCalendarDays]);

  const moveSelection = useCallback((index: number) => {
    const maxIndex = Math.max(0, visibleCalendarDays.length - 1);
    const bounded = Math.max(0, Math.min(maxIndex, index));
    const nextDate = visibleCalendarDays[bounded]?.date;
    if (!nextDate) return;
    keyboardNavRef.current = true;
    handleSelectDate(nextDate);
  }, [handleSelectDate, visibleCalendarDays]);

  const handleDayKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!selectedDate) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(index + 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(index - 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(index + 7);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(index - 7);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveSelection(Math.floor(index / 7) * 7);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveSelection(Math.floor(index / 7) * 7 + 6);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      const next = addMonths(selectedDate, 1);
      keyboardNavRef.current = true;
      handleSelectDate(next);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      const prev = subMonths(selectedDate, 1);
      keyboardNavRef.current = true;
      handleSelectDate(prev);
    }
  }, [handleSelectDate, moveSelection, selectedDate]);

  const currentMonthEventDates = useMemo(() => {
    return calendarDays
      .filter((day) => day.isCurrentMonth && day.events.length > 0)
      .map((day) => day.date);
  }, [calendarDays]);

  // If the selected date is empty, auto-focus the nearest day with events in the active month.
  useEffect(() => {
    if (hoveredDate) return;
    if (currentMonthEventDates.length === 0) return;

    const selectedHasEvents = selectedDate
      ? (eventsByDate.get(format(selectedDate, "yyyy-MM-dd"))?.length ?? 0) > 0
      : false;

    if (selectedDate && isSameMonth(selectedDate, currentMonth) && selectedHasEvents) return;

    const referenceDate = isSameMonth(currentMonth, new Date()) ? new Date() : startOfMonth(currentMonth);
    let nearest = currentMonthEventDates[0];
    let smallestDiff = Math.abs(nearest.getTime() - referenceDate.getTime());

    for (let i = 1; i < currentMonthEventDates.length; i++) {
      const candidate = currentMonthEventDates[i];
      const diff = Math.abs(candidate.getTime() - referenceDate.getTime());
      if (diff < smallestDiff) {
        smallestDiff = diff;
        nearest = candidate;
      }
    }

    if (!selectedDate || !isSameDay(selectedDate, nearest)) {
      const frame = requestAnimationFrame(() => {
        setSelectedDate(nearest);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [currentMonth, currentMonthEventDates, eventsByDate, hoveredDate, selectedDate]);

  // Get unique categories for a day (for color dots)
  const getDayCategories = useCallback((dayEvents: CalendarEvent[]) => {
    const categories = new Set<string>();
    dayEvents.forEach((e) => {
      if (e.category) categories.add(e.category);
    });
    // Sort by priority and take top 3 for visual clarity in dense months
    return CATEGORY_PRIORITY.filter((c) => categories.has(c)).slice(0, 3);
  }, []);

  // Get film genre color for a day's film events
  const getFilmGenreColor = useCallback((dayEvents: CalendarEvent[]): string | null => {
    for (const event of dayEvents) {
      if (event.category === "film" && event.genres) {
        for (const genre of event.genres) {
          const normalized = genre.toLowerCase();
          if (FILM_GENRE_COLORS[normalized]) {
            return FILM_GENRE_COLORS[normalized];
          }
        }
      }
    }
    return null;
  }, []);

  // Calculate event density for heat map effect
  const maxEventsInDay = useMemo(() => {
    let max = 0;
    calendarDays.forEach((d) => {
      if (d.events.length > max) max = d.events.length;
    });
    return max || 1;
  }, [calendarDays]);

  const { highVolumeCellThreshold, ultraVolumeCellThreshold, denseListThreshold, ultraDenseListThreshold } = useMemo(() => {
    const monthlyCounts = calendarDays
      .filter((day) => day.isCurrentMonth && day.events.length > 0)
      .map((day) => day.events.length)
      .sort((a, b) => a - b);

    if (monthlyCounts.length === 0) {
      return {
        highVolumeCellThreshold: Number.POSITIVE_INFINITY,
        ultraVolumeCellThreshold: Number.POSITIVE_INFINITY,
        denseListThreshold: Number.POSITIVE_INFINITY,
        ultraDenseListThreshold: Number.POSITIVE_INFINITY,
      };
    }

    const denseListBase = Math.round(getPercentile(monthlyCounts, DESKTOP_DENSITY_TUNING.denseListPercentile));
    const highCellBase = Math.round(getPercentile(monthlyCounts, DESKTOP_DENSITY_TUNING.highCellPercentile));
    const ultraDenseListBase = Math.round(getPercentile(monthlyCounts, DESKTOP_DENSITY_TUNING.ultraDenseListPercentile));
    const ultraCellBase = Math.round(getPercentile(monthlyCounts, DESKTOP_DENSITY_TUNING.ultraCellPercentile));

    const highCell = Math.max(DESKTOP_DENSITY_TUNING.minHighCellThreshold, highCellBase);
    const ultraCell = Math.max(highCell + DESKTOP_DENSITY_TUNING.minUltraCellGap, ultraCellBase);
    const denseList = Math.max(DESKTOP_DENSITY_TUNING.minDenseListThreshold, denseListBase);
    const ultraDenseList = Math.max(denseList + DESKTOP_DENSITY_TUNING.minUltraDenseGap, ultraDenseListBase);

    return {
      highVolumeCellThreshold: highCell,
      ultraVolumeCellThreshold: ultraCell,
      denseListThreshold: denseList,
      ultraDenseListThreshold: ultraDenseList,
    };
  }, [calendarDays]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className={fullBleed ? "py-0" : "py-3"}>
      <div
        className={
          fullBleed
            ? "p-4 lg:p-5"
            : "rounded-2xl border border-[var(--twilight)]/80 bg-gradient-to-b from-[var(--night)]/95 to-[var(--void)]/90 shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md p-4 lg:p-5"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0">
              <h2 className="font-mono text-2xl font-bold text-[var(--cream)] truncate">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <p className="font-mono text-[11px] text-[var(--muted)] mt-0.5">
                {formatCompactCount(summary.totalEvents)} events across {summary.daysWithEvents} days
              </p>
            </div>
            {(loading || isRefetching) && initialLoadDone && (
              <span className="w-4 h-4 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin flex-shrink-0" />
            )}
            {!isSameMonth(currentMonth, new Date()) && (
              <button
                onClick={goToToday}
                className="px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold bg-[var(--gold)] text-[var(--void)] hover:bg-[var(--coral)] transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]"
              >
                Today
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-0.5 rounded-xl border border-[var(--twilight)]/80 bg-[var(--void)]/60 flex-shrink-0">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70"
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[clamp(320px,31vw,430px)_minmax(0,1fr)] gap-4 lg:gap-5">
          {/* Month navigator */}
          <div className="rounded-xl border border-[var(--twilight)]/65 bg-[var(--night)]/44 p-3 sm:p-3.5">
            <div className="grid grid-cols-7 mb-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-1.5 text-center font-mono text-[0.58rem] text-[var(--muted)] uppercase tracking-[0.14em]"
                >
                  {day}
                </div>
              ))}
            </div>

            <div
              key={format(currentMonth, "yyyy-MM")}
              className="grid grid-cols-7 gap-1 animate-fade-in"
            >
              {visibleCalendarDays.map((day, idx) => {
                const isSelected = selectedDate && isSameDay(day.date, selectedDate);
                const dayEventCount = day.events.length;
                const hasEvents = dayEventCount > 0;
                const categories = getDayCategories(day.events);
                const topCategory = categories[0] ?? null;
                const density = dayEventCount / maxEventsInDay;
                const densityClass =
                  hasEvents && day.isCurrentMonth && !isSelected
                    ? dayEventCount >= ultraVolumeCellThreshold
                      ? "bg-[var(--coral)]/28 border-[var(--coral)]/45"
                      : dayEventCount >= highVolumeCellThreshold
                        ? "bg-[var(--coral)]/21 border-[var(--coral)]/35"
                        : density >= 0.35
                          ? "bg-[var(--coral)]/14 border-[var(--coral)]/28"
                          : "bg-[var(--coral)]/9 border-[var(--twilight)]/70"
                    : "";

                return (
                  <button
                    key={idx}
                    ref={(element) => {
                      dayButtonRefs.current[idx] = element;
                    }}
                    onClick={() => handleSelectDate(day.date)}
                    onMouseEnter={() => day.isCurrentMonth && setHoveredDate(day.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    onFocus={() => day.isCurrentMonth && setHoveredDate(day.date)}
                    onBlur={() => setHoveredDate(null)}
                    onKeyDown={(event) => handleDayKeyDown(event, idx)}
                    tabIndex={idx === selectedIndex ? 0 : -1}
                    aria-current={day.isToday ? "date" : undefined}
                    aria-pressed={Boolean(isSelected)}
                    aria-label={`${format(day.date, "EEEE, MMMM d, yyyy")}${hasEvents ? `, ${dayEventCount} events` : ", no events"}`}
                    className={`
                      relative h-[56px] sm:h-[60px] p-1.5 rounded-lg border transition-all duration-150 outline-none
                      focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]
                      ${day.isCurrentMonth ? "hover:border-[var(--coral)]/55 hover:bg-[var(--twilight)]/42" : "opacity-30"}
                      ${isSelected
                        ? "border-[var(--gold)] bg-[var(--twilight)]/72 shadow-[0_10px_24px_rgba(0,0,0,0.26)]"
                        : "border-[var(--twilight)]/60 bg-[var(--night)]/34 hover:bg-[var(--twilight)]/34"
                      }
                      ${day.isToday ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--void)]" : ""}
                      ${densityClass}
                    `}
                  >
                    <span
                      className={`
                        absolute top-1.5 left-1.5 font-mono text-[13px] font-medium
                        ${day.isToday ? "text-[var(--gold)]" : ""}
                        ${isSelected ? "text-[var(--coral)]" : ""}
                        ${!day.isToday && !isSelected ? (day.isPast ? "text-[var(--muted)]/60" : "text-[var(--cream)]") : ""}
                      `}
                    >
                      {format(day.date, "d")}
                    </span>

                    {hasEvents && day.isCurrentMonth && (
                      <>
                        <span className={`absolute top-1.5 right-1.5 px-1 py-0.5 rounded-md font-mono text-[0.58rem] font-semibold border ${
                      isSelected
                        ? "text-[var(--cream)] border-[var(--gold)]/45 bg-[var(--twilight)]/86"
                        : dayEventCount >= ultraVolumeCellThreshold
                          ? "text-[var(--cream)] border-[var(--coral)]/55 bg-[var(--coral)]/20 shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
                          : dayEventCount >= highVolumeCellThreshold
                            ? "text-[var(--soft)] border-[var(--coral)]/35 bg-[var(--coral)]/13"
                            : "text-[var(--muted)] border-[var(--twilight)]/70 bg-[var(--void)]/50"
                    }`}>
                          {formatCompactCount(dayEventCount)}
                        </span>

                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                          {topCategory && (() => {
                            const filmGenreColor = topCategory === "film" ? getFilmGenreColor(day.events) : null;
                            return (
                              <span
                                data-category={topCategory}
                                className="w-1.5 h-1.5 rounded-full bg-[var(--category-color,var(--muted))]"
                                style={filmGenreColor ? { backgroundColor: filmGenreColor } : undefined}
                              />
                            );
                          })()}
                          {categories.length > 1 && (
                            <span className="font-mono text-[0.52rem] text-[var(--muted)]/90">
                              +{categories.length - 1}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {currentMonthEventDates.length === 0 && (
              <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
                No event-heavy days in this month yet.
              </p>
            )}
          </div>

          {/* Day agenda */}
          <div className="rounded-xl border border-[var(--twilight)]/65 bg-[var(--night)]/44 overflow-hidden min-h-[520px]">
            {activeDate ? (
              <>
                <div className="sticky top-0 z-10 px-4 py-3 border-b border-[var(--twilight)]/65 bg-[var(--void)]/92 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] text-[var(--muted)] uppercase tracking-widest">
                        {format(activeDate, "EEEE")}
                      </div>
                      <div className="font-mono text-[2rem] leading-none font-bold text-[var(--cream)] mt-1">
                        {format(activeDate, "MMMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hoveredDate && selectedDate && !isSameDay(hoveredDate, selectedDate) && (
                        <span className="inline-block px-2 py-0.5 rounded-full border border-[var(--twilight)]/75 bg-[var(--void)]/70 text-[var(--muted)] font-mono text-[0.6rem] font-medium">
                          Preview
                        </span>
                      )}
                      {isToday(activeDate) && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--gold)] text-[var(--void)] font-mono text-[0.6rem] font-medium">
                          TODAY
                        </span>
                      )}
                      {activeDayEvents.length > 0 && (
                        <span className="inline-block px-2 py-0.5 rounded-full border border-[var(--twilight)]/75 bg-[var(--dusk)]/70 text-[var(--soft)] font-mono text-[0.6rem] font-medium">
                          {formatCompactCount(activeDayEvents.length)} events
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3.5">
                  {loading && !initialLoadDone ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-3 w-12 rounded skeleton-shimmer" />
                            <div className="h-4 w-10 rounded-full skeleton-shimmer" />
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3.5 h-3.5 rounded skeleton-shimmer" />
                            <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                          </div>
                          <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                        </div>
                      ))}
                    </div>
                  ) : activeDayEvents.length > 0 ? (
                    <>
                      <div className={`${activeDayEvents.length >= denseListThreshold ? "space-y-2" : "space-y-2.5"} max-h-[clamp(280px,58vh,720px)] overflow-y-auto pr-1.5 scrollbar-thin`}>
                        {activeDayEvents.map((event, index) => {
                          const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
                          const title = decodeHtmlEntities(event.title);
                          const venueName = event.venue?.name ? decodeHtmlEntities(event.venue.name) : null;
                          const venueNeighborhood = event.venue?.neighborhood ? decodeHtmlEntities(event.venue.neighborhood) : null;
                          const denseDay = activeDayEvents.length >= denseListThreshold;
                          const ultraDenseDay = activeDayEvents.length >= ultraDenseListThreshold;

                          return (
                            <Link
                              key={event.id}
                              href={`/${portalSlug}?event=${event.id}`}
                              scroll={false}
                              data-category={event.category || undefined}
                              className={`block ${denseDay ? "p-3" : "p-3.5"} rounded-xl border border-[var(--twilight)]/85 bg-[var(--card-bg)] calendar-event-card group animate-fade-up hover:border-[var(--coral)]/35`}
                              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`font-mono ${denseDay ? "text-[10px]" : "text-[11px]"} text-[var(--soft)]`}>
                                  {time}
                                  {period && <span className="text-[0.6rem] ml-0.5 opacity-60">{period}</span>}
                                </span>
                                {event.is_free && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-mono text-[0.55rem] font-semibold">
                                    FREE
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {event.category && (
                                  <CategoryIcon type={event.category} size={denseDay ? 12 : 14} className="flex-shrink-0 opacity-70" />
                                )}
                                <span className={`text-[var(--cream)] ${denseDay ? "text-[14px]" : "text-[15px]"} leading-snug group-hover:text-[var(--coral)] transition-colors ${ultraDenseDay ? "line-clamp-1" : "line-clamp-2"}`}>
                                  {title}
                                </span>
                              </div>

                              {venueName && (
                                <div className="mt-1.5 text-xs text-[var(--muted)]/95 truncate">
                                  {venueName}
                                  {venueNeighborhood && (
                                    <span className="opacity-65"> · {venueNeighborhood}</span>
                                  )}
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>

                      {activeDate && (
                        <Link
                          href={`/${portalSlug}?view=events&date_start=${format(activeDate, "yyyy-MM-dd")}&date_end=${format(activeDate, "yyyy-MM-dd")}`}
                          className="block mt-3 text-center py-2.5 rounded-xl border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--coral)]/50 transition-colors font-mono text-xs"
                        >
                          View all {formatCompactCount(activeDayEvents.length)} events in list view
                        </Link>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-[var(--muted)] text-sm">No events for this day</p>
                      <p className="text-[var(--muted)]/60 text-xs mt-1">
                        {isBefore(activeDate, new Date()) && !isToday(activeDate)
                          ? "That date has passed."
                          : "Try another day in the month navigator."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-[var(--muted)]">
                <p>Select a day to see events</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
