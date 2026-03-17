"use client";

import Dot from "@/components/ui/Dot";

export interface DatePillStripProps {
  dates: string[]; // YYYY-MM-DD strings
  selectedDate: string;
  onSelect: (date: string) => void;
  todayLabel?: string; // "Today" for film, "Tonight" for music
  summaryItems?: { label: string; value: string | number }[];
}

function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
}: DatePillStripProps) {
  const hasSummary =
    summaryItems && summaryItems.length > 0 && summaryItems.some((s) => Number(s.value) > 0);

  return (
    <section className="mb-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)]/70 backdrop-blur-md p-3 sm:p-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
        {dates.map((dateStr) => {
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
