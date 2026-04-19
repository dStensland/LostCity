"use client";

import { useActiveMonth } from "./useActiveMonth";

const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export interface BigStuffCollapsedStripProps {
  monthKeys: string[];
  onJump: (monthKey: string) => void;
}

export default function BigStuffCollapsedStrip({
  monthKeys,
  onJump,
}: BigStuffCollapsedStripProps) {
  const active = useActiveMonth(monthKeys);

  return (
    <div
      role="navigation"
      aria-label="Jump to month (compact)"
      className="sticky top-0 z-30 min-h-[44px] sm:h-8 sm:min-h-0 bg-[var(--void)]/95 border-b border-[var(--twilight)] backdrop-blur-sm"
    >
      <div className="flex items-center h-full overflow-x-auto snap-x snap-mandatory px-4 gap-4 max-w-6xl mx-auto">
        {monthKeys.map((key) => {
          const isActive = key === active;
          const m = parseInt(key.slice(5, 7), 10);
          return (
            <button
              key={key}
              onClick={() => onJump(key)}
              aria-current={isActive ? "location" : undefined}
              className={`flex-shrink-0 snap-start font-mono text-2xs tracking-[0.08em] uppercase px-1 py-0.5 focus-ring ${
                isActive
                  ? "text-[var(--gold)] underline decoration-[var(--gold)] underline-offset-[4px]"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {MONTH_LABELS[m - 1]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
