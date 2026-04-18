"use client";

import type { DateCount } from '@/lib/film/date-counts-loader';

const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function fmtMonthDay(iso: string): { wd: string; dom: number } {
  const d = new Date(iso + 'T00:00:00Z');
  return { wd: WEEKDAY_SHORT[d.getUTCDay()], dom: d.getUTCDate() };
}

interface DateStripProps {
  counts: DateCount[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}

export default function DateStrip({ counts, selectedDate, today, onSelect }: DateStripProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          The next two weeks
        </span>
        <span className="font-mono text-xs text-[var(--muted)] opacity-60">
          Pick a date ↗
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {counts.map((c) => {
          const isActive = c.date === selectedDate;
          const isToday = c.date === today;
          const { wd, dom } = fmtMonthDay(c.date);
          const borderTone = isActive
            ? 'bg-[var(--vibe)]/15 border-[var(--vibe)]/50 text-[var(--cream)]'
            : isToday
              ? 'border-[var(--gold)]/40 text-[var(--cream)]'
              : 'border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--muted)]';
          return (
            <button
              key={c.date}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(c.date)}
              className={`flex-shrink-0 w-[88px] h-[86px] rounded-card border flex flex-col items-center justify-center gap-0.5 transition-colors ${borderTone}`}
            >
              <span
                className={`font-mono text-2xs font-bold uppercase tracking-[0.14em] ${
                  isToday ? 'text-[var(--gold)]' : ''
                }`}
              >
                {isToday ? 'TODAY' : wd}
              </span>
              <span className="font-display text-2xl tabular-nums leading-none">{dom}</span>
              {c.hasPremiere ? (
                <span className="font-mono text-2xs text-[var(--gold)]">★ premiere</span>
              ) : (
                <span className="font-mono text-2xs text-[var(--muted)]">
                  {c.count === 0 ? '—' : c.count === 1 ? '1 film' : `${c.count} films`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
