"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  isBefore,
  addWeeks,
  subWeeks,
} from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";

// Category to CSS variable mapping
const categoryColors: Record<string, string> = {
  music: "var(--cat-music)",
  film: "var(--cat-film)",
  comedy: "var(--cat-comedy)",
  theater: "var(--cat-theater)",
  art: "var(--cat-art)",
  community: "var(--cat-community)",
  food: "var(--cat-food)",
  sports: "var(--cat-sports)",
  fitness: "var(--cat-fitness)",
  nightlife: "var(--cat-nightlife)",
  family: "var(--cat-family)",
};

function getCategoryColor(category: string | null): string {
  if (!category) return "var(--muted)";
  const normalized = category.toLowerCase().replace(/[^a-z]/g, "");
  return categoryColors[normalized] || "var(--muted)";
}

interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  category: string | null;
  rsvp_status: "going" | "interested" | "went";
  venue: {
    name: string;
    slug: string | null;
  } | null;
}

interface WeekViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDayClick: (date: Date) => void;
  selectedDate: Date | null;
  portalSlug?: string;
}

// Time slots from 6am to midnight
const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 6am to midnight (24)
const HOUR_HEIGHT = 48; // pixels per hour

function parseTime(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + minutes / 60;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export default function WeekView({
  currentDate,
  onDateChange,
  eventsByDate,
  onDayClick,
  selectedDate,
  portalSlug = "la",
}: WeekViewProps) {
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const dateKey = format(date, "yyyy-MM-dd");
      return {
        date,
        dateKey,
        events: eventsByDate.get(dateKey) || [],
        isToday: isToday(date),
        isPast: isBefore(date, new Date()) && !isToday(date),
        isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      };
    });
  }, [weekStart, eventsByDate, selectedDate]);

  // Navigate weeks
  const goToPrevWeek = () => onDateChange(subWeeks(currentDate, 1));
  const goToNextWeek = () => onDateChange(addWeeks(currentDate, 1));
  const goToToday = () => onDateChange(new Date());

  // Get all-day events for each day
  const allDayEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    weekDays.forEach((day) => {
      const allDay = day.events.filter((e) => e.is_all_day || !e.start_time);
      if (allDay.length > 0) {
        map.set(day.dateKey, allDay);
      }
    });
    return map;
  }, [weekDays]);

  // Get timed events for positioning
  const timedEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    weekDays.forEach((day) => {
      const timed = day.events.filter((e) => !e.is_all_day && e.start_time);
      if (timed.length > 0) {
        map.set(day.dateKey, timed);
      }
    });
    return map;
  }, [weekDays]);

  return (
    <div className="bg-gradient-to-br from-[var(--deep-violet)] to-[var(--midnight-blue)] rounded-xl border border-[var(--nebula)] overflow-hidden">
      {/* Week header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--nebula)]">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-lg font-bold text-[var(--cream)]">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 rounded-full font-mono text-xs font-medium bg-[var(--coral)]/20 text-[var(--coral)] hover:bg-[var(--coral)]/30 transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-lg hover:bg-[var(--twilight-purple)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg hover:bg-[var(--twilight-purple)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--nebula)]">
        <div className="p-2" /> {/* Time column spacer */}
        {weekDays.map((day) => (
          <button
            key={day.dateKey}
            onClick={() => onDayClick(day.date)}
            className={`
              p-3 text-center border-l border-[var(--nebula)]/50 transition-colors
              ${day.isSelected ? "bg-[var(--cosmic-blue)]" : "hover:bg-[var(--twilight-purple)]/30"}
              ${day.isToday ? "bg-[var(--twilight-purple)]/20" : ""}
            `}
          >
            <div className="font-mono text-[0.65rem] text-[var(--muted)] uppercase">
              {format(day.date, "EEE")}
            </div>
            <div
              className={`
                font-mono text-lg font-bold mt-0.5
                ${day.isToday ? "text-[var(--neon-magenta)]" : ""}
                ${day.isSelected && !day.isToday ? "text-[var(--coral)]" : ""}
                ${!day.isToday && !day.isSelected ? (day.isPast ? "text-[var(--muted)]" : "text-[var(--cream)]") : ""}
              `}
            >
              {format(day.date, "d")}
            </div>
          </button>
        ))}
      </div>

      {/* All-day events row */}
      {Array.from(allDayEventsByDate.values()).some((e) => e.length > 0) && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--nebula)]">
          <div className="p-2 font-mono text-[0.6rem] text-[var(--muted)]">ALL DAY</div>
          {weekDays.map((day) => {
            const allDayEvents = allDayEventsByDate.get(day.dateKey) || [];
            return (
              <div
                key={`allday-${day.dateKey}`}
                className="p-1 border-l border-[var(--nebula)]/50 min-h-[40px]"
              >
                {allDayEvents.slice(0, 2).map((event) => (
                  <Link
                    key={event.id}
                    href={`/${portalSlug}?event=${event.id}`}
                    scroll={false}
                    className="block mb-1 px-2 py-1 rounded text-[0.6rem] truncate transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${getCategoryColor(event.category)} 20%, transparent)`,
                      borderLeft: `2px solid ${getCategoryColor(event.category)}`,
                    }}
                    title={event.title}
                  >
                    <span className="text-[var(--cream)]">{event.title}</span>
                  </Link>
                ))}
                {allDayEvents.length > 2 && (
                  <span className="text-[0.55rem] text-[var(--muted)]">
                    +{allDayEvents.length - 2} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
        {/* Time labels column */}
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute right-2 font-mono text-[0.6rem] text-[var(--muted)] -translate-y-1/2"
              style={{ top: (hour - 6) * HOUR_HEIGHT }}
            >
              {formatHour(hour)}
            </div>
          ))}
          <div style={{ height: HOURS.length * HOUR_HEIGHT }} />
        </div>

        {/* Day columns with events */}
        {weekDays.map((day) => {
          const timedEvents = timedEventsByDate.get(day.dateKey) || [];

          return (
            <div
              key={`grid-${day.dateKey}`}
              className={`
                relative border-l border-[var(--nebula)]/50
                ${day.isToday ? "bg-[var(--twilight-purple)]/10" : ""}
                ${day.isSelected ? "bg-[var(--cosmic-blue)]/20" : ""}
              `}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={`line-${hour}`}
                  className="absolute w-full border-t border-[var(--nebula)]/20"
                  style={{ top: (hour - 6) * HOUR_HEIGHT }}
                />
              ))}

              {/* Events */}
              {timedEvents.map((event, idx) => {
                const startHour = parseTime(event.start_time);
                const endHour = event.end_time ? parseTime(event.end_time) : (startHour ? startHour + 1 : null);

                if (startHour === null) return null;

                const top = Math.max((startHour - 6) * HOUR_HEIGHT, 0);
                const height = endHour
                  ? Math.max((endHour - startHour) * HOUR_HEIGHT, 30)
                  : HOUR_HEIGHT;

                // Check for conflicts (overlapping events)
                const conflicting = timedEvents.filter((e, i) => {
                  if (i === idx) return false;
                  const eStart = parseTime(e.start_time);
                  const eEnd = e.end_time ? parseTime(e.end_time) : (eStart ? eStart + 1 : null);
                  if (eStart === null || startHour === null) return false;
                  return !(eEnd! <= startHour || eStart >= endHour!);
                });

                const conflictIndex = conflicting.length > 0
                  ? timedEvents.filter((e, i) => i < idx && conflicting.includes(e)).length
                  : 0;
                const totalConflicts = conflicting.length + 1;
                const width = totalConflicts > 1 ? `${100 / totalConflicts}%` : "calc(100% - 4px)";
                const left = totalConflicts > 1 ? `${(conflictIndex * 100) / totalConflicts}%` : "2px";

                return (
                  <Link
                    key={event.id}
                    href={`/${portalSlug}?event=${event.id}`}
                    scroll={false}
                    className="absolute rounded-md overflow-hidden transition-all hover:scale-[1.02] hover:z-10 group"
                    style={{
                      top,
                      height,
                      left,
                      width,
                      backgroundColor: `color-mix(in srgb, ${getCategoryColor(event.category)} 30%, var(--midnight-blue))`,
                      borderLeft: `3px solid ${getCategoryColor(event.category)}`,
                    }}
                    title={`${event.title}${event.venue ? ` @ ${event.venue.name}` : ""}`}
                  >
                    <div className="p-1.5 h-full flex flex-col">
                      <div className="flex items-center gap-1">
                        {event.category && (
                          <CategoryIcon
                            type={event.category}
                            size={10}
                            className="flex-shrink-0 opacity-70"
                          />
                        )}
                        <span className="text-[0.6rem] text-[var(--cream)] font-medium truncate group-hover:text-white">
                          {event.title}
                        </span>
                      </div>
                      {height > 50 && event.venue && (
                        <span className="text-[0.55rem] text-[var(--muted)] truncate mt-0.5">
                          {event.venue.name}
                        </span>
                      )}
                      {/* RSVP status dot */}
                      <span
                        className={`
                          absolute top-1 right-1 w-1.5 h-1.5 rounded-full
                          ${event.rsvp_status === "going" ? "bg-[var(--coral)]" : "bg-[var(--gold)]"}
                        `}
                      />
                    </div>
                  </Link>
                );
              })}

              {/* Bottom spacer for scrolling */}
              <div style={{ height: HOURS.length * HOUR_HEIGHT }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
