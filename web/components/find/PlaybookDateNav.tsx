"use client";

import { useMemo } from "react";
import { addDays, format, isToday, isTomorrow } from "date-fns";

interface PlaybookDateNavProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getDateLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  // Show "This Weekend" for the upcoming Fri/Sat/Sun if we're before Friday
  return format(d, "EEE");
}

export default function PlaybookDateNav({ selectedDate, onDateChange }: PlaybookDateNavProps) {
  const dateOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const options: { date: string; label: string; sublabel: string }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      options.push({
        date: toDateString(d),
        label: getDateLabel(d),
        sublabel: format(d, "MMM d"),
      });
    }

    // Add "This Weekend" as a special option if today is before Friday
    // (We'll handle this as selecting Friday's date)
    return options;
  }, []);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {dateOptions.map((opt) => {
        const isActive = selectedDate === opt.date;
        return (
          <button
            key={opt.date}
            onClick={() => onDateChange(opt.date)}
            className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl font-mono text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 ${
              isActive
                ? "bg-gradient-to-b from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
                : "bg-[var(--void)]/50 border border-[var(--twilight)]/60 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)]"
            }`}
          >
            <span className="text-[11px] font-semibold">{opt.label}</span>
            <span className={`text-[10px] ${isActive ? "text-[var(--void)]/70" : "text-[var(--muted)]/60"}`}>
              {opt.sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
