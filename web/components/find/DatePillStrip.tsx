"use client";

import { useRef } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import { toLocalIsoDate } from "@/lib/show-card-utils";

export interface DatePillStripProps {
  dates: string[]; // YYYY-MM-DD strings
  selectedDate: string;
  onSelect: (date: string) => void;
  todayLabel?: string; // "Today" for film, "Tonight" for music
  summaryItems?: { label: string; value: string | number }[];
  maxVisible?: number; // default 5
}

function formatDatePill(dateStr: string, todayLabel: string): string {
  const now = new Date();
  const today = toLocalIsoDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toLocalIsoDate(tomorrow);

  if (dateStr === today) return todayLabel;
  if (dateStr === tomorrowStr) return "Tomorrow";

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DatePillStrip({
  dates,
  selectedDate,
  onSelect,
  todayLabel = "Today",
  summaryItems,
  maxVisible = 5,
}: DatePillStripProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const hasSummary =
    summaryItems && summaryItems.length > 0 && summaryItems.some((s) => Number(s.value) > 0);

  // Show first N pills, but always include the selected date if it's beyond the visible range
  const selectedIdx = dates.indexOf(selectedDate);
  const visibleDates = dates.slice(0, maxVisible);
  const selectedIsHidden = selectedIdx >= maxVisible;

  // Date range for the native picker
  const minDate = dates.length > 0 ? dates[0] : undefined;
  const maxDate = dates.length > 0 ? dates[dates.length - 1] : undefined;

  return (
    <section className="mb-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)] p-3 sm:p-4">
      <div className="flex items-center gap-2 -mx-1 px-1 pb-0.5">
        {/* Selected date pill (when it's beyond visible range) */}
        {selectedIsHidden && (
          <button
            type="button"
            className="flex-shrink-0 px-3.5 py-2 rounded-full font-mono text-xs whitespace-nowrap bg-gradient-to-r from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
          >
            {formatDatePill(selectedDate, todayLabel)}
          </button>
        )}

        {/* Visible date pills */}
        {visibleDates.map((dateStr) => {
          const isActive = selectedDate === dateStr;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelect(dateStr)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full font-mono text-xs whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
                isActive
                  ? "bg-gradient-to-r from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
                  : "bg-[var(--night)]/70 border border-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--coral)]/40"
              }`}
            >
              {formatDatePill(dateStr, todayLabel)}
            </button>
          );
        })}

        {/* Pick a date button */}
        {dates.length > maxVisible && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs whitespace-nowrap bg-[var(--night)]/70 border border-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--coral)]/40 transition-all"
            >
              <CalendarBlank weight="bold" size={14} />
              <span className="hidden sm:inline">Pick date</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              tabIndex={-1}
              min={minDate}
              max={maxDate}
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) onSelect(e.target.value);
              }}
            />
          </div>
        )}
      </div>

      {hasSummary && (
        <div className="flex flex-wrap items-center gap-3 mt-2.5 pt-2 border-t border-[var(--twilight)]/40">
          {summaryItems!.map((item, idx) => (
            <span key={item.label} className="contents">
              {idx > 0 && <Dot className="text-[var(--muted)]/40" />}
              <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.1em]">
                {item.value} {item.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export type { DatePillStripProps as DatePillProps };
