"use client";

import { memo } from "react";
import { CalendarBlank } from "@phosphor-icons/react";

interface CalendarViewProps {
  portalSlug: string;
}

export const CalendarView = memo(function CalendarView({ portalSlug: _portalSlug }: CalendarViewProps) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "color-mix(in srgb, var(--coral) 12%, white)" }}
      >
        <CalendarBlank
          size={28}
          weight="duotone"
          style={{ color: "var(--coral)" }}
        />
      </div>
      <h2
        className="text-lg font-semibold text-[var(--cream)] mb-2"
        style={{ fontFamily: "var(--font-outfit, system-ui, sans-serif)" }}
      >
        Family Calendar
      </h2>
      <p className="text-sm text-[var(--muted)] max-w-xs">
        School holidays, program start dates, and your family&rsquo;s upcoming events — all in one place. Coming soon.
      </p>
    </div>
  );
});

export type { CalendarViewProps };
