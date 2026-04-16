"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { useCalendarEvents, useFriendCalendarEvents } from "@/lib/calendar/useCalendarData";
import {
  useEventsByDate,
  useFriendEventsByDate,
  usePlansByDate,
  useCalendarGrid,
} from "@/lib/calendar/useCalendarDerived";
import { MiniDayCell } from "./MiniDayCell";

interface MonthMinimapProps {
  onSelectDate: (date: Date) => void;
}

export function MonthMinimap({ onSelectDate }: MonthMinimapProps) {
  const { state, dispatch } = useCalendar();

  // Data hooks for grid computation
  const { data: calendarData } = useCalendarEvents();
  const { data: friendData } = useFriendCalendarEvents();
  const eventsByDate = useEventsByDate(calendarData?.events);
  const friendEventsByDate = useFriendEventsByDate(friendData?.events);
  const plansByDate = usePlansByDate(calendarData?.plans);

  const calendarDays = useCalendarGrid(
    state.currentMonth,
    eventsByDate,
    friendEventsByDate,
    plansByDate
  );

  const monthLabel = state.currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth =
    new Date().getMonth() === state.currentMonth.getMonth() &&
    new Date().getFullYear() === state.currentMonth.getFullYear();

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => dispatch({ type: "PREV_MONTH" })}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors duration-200"
          aria-label="Previous month"
        >
          <CaretLeft size={16} weight="bold" />
        </button>
        <span className="text-sm font-medium text-[var(--cream)]">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => dispatch({ type: "GO_TO_TODAY" })}
            className={`text-xs px-2 py-1 rounded transition-colors duration-200 ${
              isCurrentMonth
                ? "text-[var(--muted)]/50"
                : "text-[var(--gold)] hover:text-[var(--gold)]/80"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => dispatch({ type: "NEXT_MONTH" })}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors duration-200"
            aria-label="Next month"
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-2xs text-[var(--muted)]/40 font-mono py-1">
            {d}
          </div>
        ))}
        {calendarDays.map((day) => (
          <MiniDayCell
            key={day.date.toISOString()}
            date={day.date}
            commitmentCount={(day.events?.length ?? 0) + (day.plans?.length ?? 0)}
            hasFriendOnly={
              (day.friendEvents?.length ?? 0) > 0 &&
              (day.events?.length ?? 0) === 0 &&
              (day.plans?.length ?? 0) === 0
            }
            isToday={day.isToday}
            isCurrentMonth={day.isCurrentMonth}
            isSelected={
              state.selectedDate?.toDateString() === day.date.toDateString()
            }
            onClick={() => onSelectDate(day.date)}
          />
        ))}
      </div>
    </div>
  );
}
