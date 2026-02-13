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
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";

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

  const hourTopClasses = HOURS.map((hour) =>
    createCssVarClassForLength(
      "--hour-top",
      `${(hour - 6) * HOUR_HEIGHT}px`,
      "week-hour"
    )
  );
  const hourTopCss = hourTopClasses
    .map((entry) => entry?.css)
    .filter(Boolean)
    .join("\n");

  const gridHeightClass = createCssVarClassForLength(
    "--grid-height",
    `${HOURS.length * HOUR_HEIGHT}px`,
    "week-grid"
  );

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
    <div className="rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] overflow-hidden">
      <ScopedStyles css={[hourTopCss, gridHeightClass?.css].filter(Boolean).join("\n")} />
      {/* Week header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--twilight)]/75 bg-gradient-to-b from-[var(--night)]/94 to-[var(--void)]/82">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-lg font-bold text-[var(--cream)]">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 rounded-full font-mono text-xs font-medium bg-[var(--gold)] text-[var(--void)] hover:bg-[var(--coral)] transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--twilight)]/75">
        <div className="p-2" /> {/* Time column spacer */}
        {weekDays.map((day) => (
          <button
            key={day.dateKey}
            onClick={() => onDayClick(day.date)}
            className={`
              p-3 text-center border-l border-[var(--twilight)]/55 transition-colors
              ${day.isSelected ? "bg-[var(--twilight)]/72" : "hover:bg-[var(--twilight)]/34"}
              ${day.isToday ? "bg-[var(--twilight)]/24" : ""}
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
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--twilight)]/75">
          <div className="p-2 font-mono text-[0.6rem] text-[var(--muted)]">ALL DAY</div>
          {weekDays.map((day) => {
            const allDayEvents = allDayEventsByDate.get(day.dateKey) || [];
            return (
              <div
                key={`allday-${day.dateKey}`}
                className="p-1 border-l border-[var(--twilight)]/55 min-h-[40px]"
              >
                {allDayEvents.slice(0, 2).map((event) => (
                  <Link
                    key={event.id}
                    href={`/${portalSlug}?event=${event.id}`}
                    scroll={false}
                    data-category={event.category || "other"}
                    className="block mb-1 px-2 py-1 rounded text-[0.6rem] truncate transition-colors hover:opacity-80 calendar-all-day"
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
              className={`absolute right-2 font-mono text-[0.6rem] text-[var(--muted)] -translate-y-1/2 calendar-hour-label ${
                hourTopClasses[hour - 6]?.className ?? ""
              }`}
            >
              {formatHour(hour)}
            </div>
          ))}
          <div className={`calendar-grid-height ${gridHeightClass?.className ?? ""}`} />
        </div>

        {/* Day columns with events */}
        {weekDays.map((day) => {
          const timedEvents = timedEventsByDate.get(day.dateKey) || [];

          return (
            <div
              key={`grid-${day.dateKey}`}
              className={`
                relative border-l border-[var(--twilight)]/55
                ${day.isToday ? "bg-[var(--twilight)]/12" : ""}
                ${day.isSelected ? "bg-[var(--twilight)]/24" : ""}
              `}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={`line-${hour}`}
                  className={`absolute w-full border-t border-[var(--twilight)]/30 calendar-hour-line ${
                    hourTopClasses[hour - 6]?.className ?? ""
                  }`}
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
                const width = totalConflicts > 1 ? `${100 / totalConflicts}%` : null;
                const left = totalConflicts > 1 ? `${(conflictIndex * 100) / totalConflicts}%` : null;

                const topClass = createCssVarClassForLength(
                  "--event-top",
                  `${top}px`,
                  "week-event-top"
                );
                const heightClass = createCssVarClassForLength(
                  "--event-height",
                  `${height}px`,
                  "week-event-height"
                );
                const leftClass = left
                  ? createCssVarClassForLength("--event-left", left, "week-event-left")
                  : null;
                const widthClass = width
                  ? createCssVarClassForLength("--event-width", width, "week-event-width")
                  : null;
                const eventCss = [topClass?.css, heightClass?.css, leftClass?.css, widthClass?.css]
                  .filter(Boolean)
                  .join("\n");

                return (
                  <>
                    <ScopedStyles css={eventCss} />
                    <Link
                      key={event.id}
                      href={`/${portalSlug}?event=${event.id}`}
                      scroll={false}
                      data-category={event.category || "other"}
                      className={`absolute rounded-md overflow-hidden transition-all hover:scale-[1.02] hover:z-10 group calendar-event ${
                        topClass?.className ?? ""
                      } ${heightClass?.className ?? ""} ${
                        totalConflicts > 1
                          ? `calendar-event-offset ${leftClass?.className ?? ""} ${widthClass?.className ?? ""}`
                          : "calendar-event-full"
                      }`}
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
                  </>
                );
              })}

              {/* Bottom spacer for scrolling */}
              <div className={`calendar-grid-height ${gridHeightClass?.className ?? ""}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
