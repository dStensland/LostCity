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
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
} from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import { decodeHtmlEntities, formatCompactCount, formatTimeSplit } from "@/lib/formats";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useCalendarEvents, type CalendarEvent } from "@/lib/hooks/useCalendarEvents";
import WeekStrip, { type WeekStripDay } from "@/components/calendar/WeekStrip";

interface Props {
  portalId?: string;
  portalSlug?: string;
  portalExclusive?: boolean;
}

// Always render 6 rows (42 days) for full month view
const CALENDAR_ROWS = 6;
const CALENDAR_DAYS = CALENDAR_ROWS * 7;
const MOBILE_DENSITY_TUNING = {
  compactPercentile: 0.65,
  emphasisPercentile: 0.9,
  minCompactThreshold: 10,
  minEmphasisGap: 6,
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

export default function MobileCalendarView({
  portalId,
  portalSlug = DEFAULT_PORTAL_SLUG,
  portalExclusive
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isExpanded, setIsExpanded] = useState(false);

  // Use React Query hook for calendar events
  const { eventsByDate, isLoading, isRefetching } = useCalendarEvents({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    portalId,
    portalExclusive,
  });

  const initialLoadDone = eventsByDate.size > 0 || !isLoading;

  // Generate week days for the strip (current week of selected date)
  const weekStripDays = useMemo((): WeekStripDay[] => {
    const weekStart = startOfWeek(selectedDate);
    const days: WeekStripDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateKey = format(date, "yyyy-MM-dd");
      const dayEvents = eventsByDate.get(dateKey) || [];
      days.push({
        date,
        dateKey,
        eventCount: dayEvents.length,
        topCategory: dayEvents[0]?.category || null,
        isToday: isToday(date),
        isPast: isBefore(date, new Date()) && !isToday(date),
        isSelected: isSameDay(date, selectedDate),
      });
    }
    return days;
  }, [selectedDate, eventsByDate]);

  // Generate full month calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const calStart = startOfWeek(monthStart);
    const today = new Date();
    const days = [];
    let day = calStart;

    for (let i = 0; i < CALENDAR_DAYS; i++) {
      const dateKey = format(day, "yyyy-MM-dd");
      days.push({
        date: new Date(day),
        dateKey,
        events: eventsByDate.get(dateKey) || [],
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isToday(day),
        isPast: isBefore(day, today) && !isToday(day),
        isSelected: isSameDay(day, selectedDate),
      });
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate, eventsByDate, selectedDate]);

  // Selected day's events
  const selectedDayEvents = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const dayEvents = eventsByDate.get(dateKey) || [];
    // Deduplicate
    const seen = new Set<number>();
    return dayEvents.filter(event => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  }, [selectedDate, eventsByDate]);

  const { compactThreshold, emphasisThreshold } = useMemo(() => {
    const monthlyCounts = calendarDays
      .filter((day) => day.isCurrentMonth && day.events.length > 0)
      .map((day) => day.events.length)
      .sort((a, b) => a - b);

    if (monthlyCounts.length === 0) {
      return {
        compactThreshold: Number.POSITIVE_INFINITY,
        emphasisThreshold: Number.POSITIVE_INFINITY,
      };
    }

    const compactBase = Math.round(getPercentile(monthlyCounts, MOBILE_DENSITY_TUNING.compactPercentile));
    const emphasisBase = Math.round(getPercentile(monthlyCounts, MOBILE_DENSITY_TUNING.emphasisPercentile));
    const compact = Math.max(MOBILE_DENSITY_TUNING.minCompactThreshold, compactBase);
    const emphasis = Math.max(compact + MOBILE_DENSITY_TUNING.minEmphasisGap, emphasisBase);

    return {
      compactThreshold: compact,
      emphasisThreshold: emphasis,
    };
  }, [calendarDays]);

  // Navigation
  const goToPrevWeek = useCallback(() => {
    setSelectedDate(d => subWeeks(d, 1));
    setCurrentDate(d => {
      const newSelected = subWeeks(selectedDate, 1);
      if (!isSameMonth(newSelected, d)) {
        return subMonths(d, 1);
      }
      return d;
    });
  }, [selectedDate]);

  const goToNextWeek = useCallback(() => {
    setSelectedDate(d => addWeeks(d, 1));
    setCurrentDate(d => {
      const newSelected = addWeeks(selectedDate, 1);
      if (!isSameMonth(newSelected, d)) {
        return addMonths(d, 1);
      }
      return d;
    });
  }, [selectedDate]);

  const goToPrevMonth = useCallback(() => {
    setCurrentDate(m => subMonths(m, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(m => addMonths(m, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  const handleDaySelect = useCallback((date: Date) => {
    setSelectedDate(date);
    if (!isSameMonth(date, currentDate)) {
      setCurrentDate(date);
    }
    // Collapse after selecting in expanded view
    if (isExpanded) {
      setIsExpanded(false);
    }
  }, [currentDate, isExpanded]);

  const weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="py-2">
      {/* Header - Month/Week label + expand toggle */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--twilight)]/50 hover:bg-[var(--twilight)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70"
          >
            <svg
              className={`w-4 h-4 text-[var(--coral)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-mono text-sm font-bold text-[var(--cream)]">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <svg
              className={`w-3 h-3 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Loading indicator */}
          {(isLoading || isRefetching) && initialLoadDone && (
            <span className="w-4 h-4 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isToday(selectedDate) && (
            <button
              onClick={goToToday}
              className="px-2 py-1 rounded-full font-mono text-[0.65rem] font-medium bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70"
            >
              Today
            </button>
          )}
          <button
            onClick={isExpanded ? goToPrevMonth : goToPrevWeek}
            className="p-2 rounded-lg hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70"
            aria-label={isExpanded ? "Previous month" : "Previous week"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={isExpanded ? goToNextMonth : goToNextWeek}
            className="p-2 rounded-lg hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70"
            aria-label={isExpanded ? "Next month" : "Next week"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Week Strip (collapsed view) */}
      {!isExpanded && (
        <WeekStrip days={weekStripDays} onSelect={handleDaySelect} className="mb-4 px-1" />
      )}

      {/* Full Month Grid (expanded view) */}
      {isExpanded && (
        <div className="mb-4 px-1">
          {/* Week day headers */}
          <div className="grid grid-cols-7 mb-1">
            {weekDayLabels.map((day, i) => (
              <div key={i} className="py-1 text-center font-mono text-[0.6rem] text-[var(--muted)] uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, idx) => {
              const hasEvents = day.events.length > 0;
              const topCategory = day.events[0]?.category;

              return (
                <button
                  key={idx}
                  onClick={() => day.isCurrentMonth && handleDaySelect(day.date)}
                  disabled={!day.isCurrentMonth}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]
                    ${day.isCurrentMonth ? "hover:bg-[var(--twilight)]/50" : "opacity-20"}
                    ${day.isSelected && day.isCurrentMonth
                      ? "bg-[var(--coral)] shadow-lg shadow-[var(--coral)]/20"
                      : ""
                    }
                    ${day.isToday && !day.isSelected ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--void)]" : ""}
                  `}
                >
                  <span className={`
                    font-mono text-sm font-medium
                    ${day.isSelected && day.isCurrentMonth ? "text-[var(--void)]" : ""}
                    ${day.isToday && !day.isSelected ? "text-[var(--gold)]" : ""}
                    ${!day.isSelected && !day.isToday ? (day.isPast ? "text-[var(--muted)]/60" : "text-[var(--cream)]") : ""}
                  `}>
                    {format(day.date, "d")}
                  </span>

                  {/* Event indicator */}
                  {hasEvents && day.isCurrentMonth && (
                    <span
                      data-category={!day.isSelected ? (topCategory || undefined) : undefined}
                      className={`absolute bottom-1 w-1 h-1 rounded-full ${
                        day.isSelected
                          ? "bg-[var(--void)]"
                          : "bg-[var(--category-color,var(--coral))]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="flex-1">
          <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
            {format(selectedDate, "EEEE")}
          </div>
          <div className="font-mono text-lg font-bold text-[var(--cream)]">
            {format(selectedDate, "MMMM d")}
          </div>
        </div>
        {isToday(selectedDate) && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--gold)] text-[var(--void)] font-mono text-[0.6rem] font-medium">
            TODAY
          </span>
        )}
        {selectedDayEvents.length > 0 && (
          <span className={`px-2 py-0.5 rounded-full font-mono text-xs ${
            selectedDayEvents.length >= emphasisThreshold
              ? "bg-[var(--coral)]/20 text-[var(--soft)] border border-[var(--coral)]/40"
              : "bg-[var(--twilight)] text-[var(--cream)]"
          }`}>
            {formatCompactCount(selectedDayEvents.length)} event{selectedDayEvents.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Events List */}
      <div className={`${selectedDayEvents.length >= compactThreshold ? "space-y-1.5" : "space-y-2"} px-1`}>
        {isLoading && !initialLoadDone ? (
          // Loading skeleton
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3 w-12 rounded skeleton-shimmer" />
                  <div className="h-4 w-10 rounded-full skeleton-shimmer" />
                </div>
                <div className="h-5 w-3/4 rounded skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded skeleton-shimmer mt-2" />
              </div>
            ))}
          </div>
        ) : selectedDayEvents.length > 0 ? (
          selectedDayEvents.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              portalSlug={portalSlug}
              index={index}
              compact={selectedDayEvents.length >= compactThreshold}
            />
          ))
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[var(--muted)] text-sm">No events</p>
            <p className="text-[var(--muted)]/60 text-xs mt-1">
              {isBefore(selectedDate, new Date()) && !isToday(selectedDate)
                ? "That day has passed"
                : "Nothing scheduled yet"}
            </p>
          </div>
        )}
      </div>

      {/* View all link */}
      {selectedDayEvents.length > 3 && (
        <Link
          href={`/${portalSlug}?view=events&date_start=${format(selectedDate, "yyyy-MM-dd")}&date_end=${format(selectedDate, "yyyy-MM-dd")}`}
          className="block mt-4 mx-1 text-center py-2.5 rounded-xl border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--coral)]/50 transition-colors font-mono text-xs"
        >
          View all {formatCompactCount(selectedDayEvents.length)} events →
        </Link>
      )}
    </div>
  );
}

// Event card component
function EventCard({
  event,
  portalSlug,
  index,
  compact,
}: {
  event: CalendarEvent;
  portalSlug: string;
  index: number;
  compact: boolean;
}) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const title = decodeHtmlEntities(event.title);
  const venueName = event.venue?.name ? decodeHtmlEntities(event.venue.name) : null;
  const venueNeighborhood = event.venue?.neighborhood ? decodeHtmlEntities(event.venue.neighborhood) : null;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      data-category={event.category || undefined}
      className={`block ${compact ? "p-2.5" : "p-3"} rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] hover:border-[var(--coral)]/40 transition-all group calendar-event-card animate-fade-up`}
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      {/* Time + badges row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`font-mono ${compact ? "text-[13px]" : "text-sm"} font-medium text-[var(--coral)]`}>
          {time}
          {period && <span className="text-xs ml-0.5 opacity-60">{period}</span>}
        </span>
        {event.is_free && (
          <span className="px-1.5 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-mono text-[0.55rem] font-medium">
            FREE
          </span>
        )}
      </div>

      {/* Title row */}
      <div className="flex items-center gap-2">
        {event.category && (
          <CategoryIcon type={event.category} size={compact ? 14 : 16} className="flex-shrink-0 opacity-60" />
        )}
        <span className={`text-[var(--cream)] ${compact ? "text-[14px]" : "font-medium"} group-hover:text-[var(--coral)] transition-colors ${compact ? "line-clamp-1" : "line-clamp-2"}`}>
          {title}
        </span>
      </div>

      {/* Venue row */}
      {venueName && (
        <div className={`mt-1.5 ${compact ? "text-[11px] pl-5" : "text-xs pl-6"} text-[var(--muted)] truncate`}>
          {venueName}
          {venueNeighborhood && (
            <span className="opacity-60"> · {venueNeighborhood}</span>
          )}
        </div>
      )}
    </Link>
  );
}
