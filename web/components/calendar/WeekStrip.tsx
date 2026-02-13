"use client";

import { format } from "date-fns";

export interface WeekStripDay {
  date: Date;
  dateKey: string;
  eventCount: number;
  topCategory: string | null;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
}

interface WeekStripProps {
  days: WeekStripDay[];
  onSelect: (date: Date) => void;
  className?: string;
}

const WEEK_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function WeekStrip({ days, onSelect, className = "" }: WeekStripProps) {
  return (
    <div className={`grid grid-cols-7 gap-1 ${className}`}>
      {days.map((day) => (
        <button
          key={day.dateKey}
          onClick={() => onSelect(day.date)}
          className={`
            flex flex-col items-center py-2 px-1 rounded-xl transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]
            ${day.isSelected
              ? "bg-[var(--coral)] shadow-lg shadow-[var(--coral)]/20"
              : "hover:bg-[var(--twilight)]/50"
            }
            ${day.isToday && !day.isSelected ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--void)]" : ""}
          `}
          aria-label={`${format(day.date, "EEEE, MMMM d")}${day.eventCount > 0 ? `, ${day.eventCount} events` : ", no events"}`}
        >
          <span className={`
            font-mono text-[0.6rem] uppercase
            ${day.isSelected ? "text-[var(--void)]" : "text-[var(--muted)]"}
          `}>
            {WEEK_DAY_LABELS[day.date.getDay()]}
          </span>

          <span className={`
            font-mono text-lg font-bold
            ${day.isSelected ? "text-[var(--void)]" : ""}
            ${day.isToday && !day.isSelected ? "text-[var(--gold)]" : ""}
            ${!day.isSelected && !day.isToday ? (day.isPast ? "text-[var(--muted)]" : "text-[var(--cream)]") : ""}
          `}>
            {format(day.date, "d")}
          </span>

          {day.eventCount > 0 && (
            <span
              data-category={!day.isSelected ? (day.topCategory || undefined) : undefined}
              className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                day.isSelected
                  ? "bg-[var(--void)]"
                  : "bg-[var(--category-color,var(--coral))]"
              }`}
            />
          )}
        </button>
      ))}
    </div>
  );
}
