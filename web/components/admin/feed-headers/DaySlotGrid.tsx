"use client";

/**
 * DaySlotGrid — 7×5 day×slot grid for the Feed Header Command Center.
 * Color-codes CMS-filled cells vs algorithm defaults.
 */

import type { FeedHeaderRow } from "@/lib/city-pulse/types";
import {
  DAYS_OF_WEEK,
  TIME_SLOTS,
  DAY_LABELS,
  SLOT_LABELS,
  findHeaderForCell,
  findOverridesForCell,
} from "@/lib/admin/feed-header-utils";

interface DaySlotGridProps {
  headers: FeedHeaderRow[];
  selectedDay: string | null;
  selectedSlot: string | null;
  onSelect: (day: string, slot: string) => void;
}

export default function DaySlotGrid({
  headers,
  selectedDay,
  selectedSlot,
  onSelect,
}: DaySlotGridProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Column headers (days) */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
          <div /> {/* spacer */}
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="text-center font-mono text-[0.625rem] uppercase tracking-wider text-[var(--muted)] py-1"
            >
              {DAY_LABELS[day]}
            </div>
          ))}
        </div>

        {/* Rows (time slots) */}
        {TIME_SLOTS.map((slot) => (
          <div key={slot} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
            {/* Row label */}
            <div className="flex items-center font-mono text-[0.5625rem] text-[var(--muted)] pr-2 justify-end">
              {SLOT_LABELS[slot]}
            </div>

            {/* Cells */}
            {DAYS_OF_WEEK.map((day) => {
              const header = findHeaderForCell(headers, day, slot);
              const overrides = findOverridesForCell(headers, day, slot);
              const isSelected = selectedDay === day && selectedSlot === slot;
              const hasCMS = !!header;
              const hasOverrides = overrides.length > 0;

              return (
                <button
                  key={`${day}-${slot}`}
                  onClick={() => onSelect(day, slot)}
                  className={`
                    relative rounded-lg h-12 transition-all text-left px-2 py-1
                    ${
                      isSelected
                        ? "ring-2 ring-[var(--coral)] bg-[var(--coral)]/10"
                        : hasCMS
                        ? "bg-[var(--twilight)]/60 hover:bg-[var(--twilight)]"
                        : "border border-dashed border-[var(--twilight)]/50 hover:border-[var(--muted)]"
                    }
                  `}
                >
                  {hasCMS ? (
                    <span className="font-mono text-[0.5rem] text-[var(--cream)]/70 line-clamp-2 leading-tight">
                      {header.headline
                        ? header.headline.slice(0, 30)
                        : header.name.slice(0, 20)}
                    </span>
                  ) : (
                    <span className="font-mono text-[0.5rem] text-[var(--muted)]/50 italic">
                      default
                    </span>
                  )}

                  {/* Override indicator */}
                  {hasOverrides && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
