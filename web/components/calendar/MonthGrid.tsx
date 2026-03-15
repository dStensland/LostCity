"use client";

import { format, isSameDay, isSameMonth } from "date-fns";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import DayCell from "@/components/calendar/DayCell";
import WeekStrip from "@/components/calendar/WeekStrip";
import type { DayData } from "@/lib/types/calendar";
import type { WeekStripDay } from "@/components/calendar/WeekStrip";

interface MonthGridProps {
  calendarDays: DayData[];
  mobileWeekStripDays: WeekStripDay[];
  isLoading?: boolean;
  isRefetching?: boolean;
  /** Compact mode for sidebar mini-month (no legend, smaller cells) */
  compact?: boolean;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthGrid({ calendarDays, mobileWeekStripDays, isLoading, isRefetching, compact }: MonthGridProps) {
  const { state, dispatch, selectDate } = useCalendar();
  const { currentMonth, selectedDate, selectedFriendIds } = state;

  const goToPrevMonth = () => dispatch({ type: "PREV_MONTH" });
  const goToNextMonth = () => dispatch({ type: "NEXT_MONTH" });
  const goToToday = () => dispatch({ type: "GO_TO_TODAY" });

  return (
    <section className={`rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <div className={`flex items-center justify-between ${compact ? "mb-3" : "mb-5"}`}>
        <div className="flex items-center gap-3">
          <h2 className={`font-mono font-bold text-[var(--cream)] ${compact ? "text-base" : "text-2xl"}`}>
            {format(currentMonth, compact ? "MMM yyyy" : "MMMM yyyy")}
          </h2>
          {(isLoading || isRefetching) && (
            <span className="w-4 h-4 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin" />
          )}
          {!isSameMonth(currentMonth, new Date()) && (
            <button
              onClick={goToToday}
              className="px-2.5 py-1 rounded-full font-mono text-xs font-semibold bg-[var(--gold)] text-[var(--void)] hover:bg-[var(--coral)] transition-colors"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-xl border border-[var(--twilight)]/80 bg-[var(--void)]/60">
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {!compact && (
        <div className="sm:hidden mb-3 px-0.5">
          <WeekStrip days={mobileWeekStripDays} onSelect={selectDate} />
          <div className="mt-2 text-xs font-mono text-[var(--muted)]">
            Week focus on mobile. Use arrows to move month.
          </div>
        </div>
      )}

      <div className={`${compact ? "grid" : "hidden sm:grid"} grid-cols-7 mb-1`}>
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center font-mono text-2xs text-[var(--muted)] uppercase tracking-[0.14em]"
          >
            {day}
          </div>
        ))}
      </div>

      <div className={`${compact ? "grid" : "hidden sm:grid"} grid-cols-7 gap-1`}>
        {calendarDays.map((day, idx) => (
          <DayCell
            key={idx}
            date={day.date}
            events={day.events}
            friendEvents={day.friendEvents}
            plans={day.plans}
            isCurrentMonth={day.isCurrentMonth}
            isToday={day.isToday}
            isPast={day.isPast}
            isSelected={selectedDate ? isSameDay(day.date, selectedDate) : false}
            onClick={() => selectDate(day.date)}
          />
        ))}
      </div>

      <div className={`mt-4 pt-3 border-t border-[var(--twilight)]/65 ${compact ? "hidden" : "hidden sm:flex"} flex-wrap items-center gap-3 text-xs text-[var(--muted)] font-mono`}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-[var(--gold)]" />
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />
          Going
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
          Interested
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--neon-cyan)]" />
          Plans
        </span>
        {selectedFriendIds.size > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-[var(--twilight)] border border-[var(--twilight)]/70" />
            Friends
          </span>
        )}
      </div>
    </section>
  );
}

export type { MonthGridProps };
