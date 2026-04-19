"use client";

const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export interface BigStuffRibbonProps {
  months: Array<{ monthKey: string; count: number; isCurrent: boolean }>;
  onJump: (monthKey: string) => void;
}

export default function BigStuffRibbon({ months, onJump }: BigStuffRibbonProps) {
  return (
    <div
      className="flex flex-row rounded-card border border-[var(--twilight)] bg-[var(--night)] overflow-hidden max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory"
      role="navigation"
      aria-label="Jump to month"
    >
      {months.map((m, idx) => (
        <button
          key={m.monthKey}
          onClick={() => onJump(m.monthKey)}
          aria-label={`Jump to ${monthLabel(m.monthKey)} · ${m.count} events`}
          className={`flex-1 max-sm:flex-shrink-0 max-sm:min-w-[110px] max-sm:snap-start p-3 text-left hover:bg-[var(--dusk)] transition-colors focus-ring ${
            idx === 0 ? "" : "border-l border-[var(--twilight)]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {m.isCurrent && (
              <span className="inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" aria-hidden />
            )}
            <span className="font-mono text-sm font-bold tracking-[0.12em] uppercase text-[var(--cream)]">
              {monthLabel(m.monthKey)}
            </span>
          </div>
          <div className="font-mono text-2xs text-[var(--muted)] tracking-[0.15em] uppercase mt-0.5">
            {m.count} event{m.count === 1 ? "" : "s"}
          </div>
        </button>
      ))}
    </div>
  );
}

function monthLabel(monthKey: string): string {
  const m = parseInt(monthKey.slice(5, 7), 10);
  return MONTH_LABELS[m - 1];
}
