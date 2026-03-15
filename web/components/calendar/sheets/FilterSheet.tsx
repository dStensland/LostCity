"use client";

import { useState } from "react";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { STATUS_FILTER_OPTIONS } from "@/lib/types/calendar";
import type { StatusFilter } from "@/lib/types/calendar";

export function FilterSheet() {
  const { state, dispatch } = useCalendar();
  const [pendingFilter, setPendingFilter] = useState<StatusFilter>(
    state.statusFilter
  );

  const handleApply = () => {
    dispatch({ type: "SET_STATUS_FILTER", filter: pendingFilter });
    dispatch({ type: "CLOSE_SHEET" });
  };

  const handleClear = () => {
    setPendingFilter("all");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Status filter */}
        <div>
          <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            Show
          </p>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_FILTER_OPTIONS.map((opt) => {
              const isActive = pendingFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setPendingFilter(opt.value)}
                  className={`min-h-[44px] flex items-center justify-center px-3 py-2.5 rounded-lg border font-mono text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[var(--coral)]/15 border-[var(--coral)]/60 text-[var(--coral)]"
                      : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)]"
                  }`}
                  aria-pressed={isActive}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3 flex gap-3">
        <button
          onClick={handleClear}
          className="flex-1 min-h-[44px] bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded-lg hover:bg-[var(--dusk)] transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={handleApply}
          className="flex-1 min-h-[44px] bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
