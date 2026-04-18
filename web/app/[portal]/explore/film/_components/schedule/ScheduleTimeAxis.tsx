"use client";

import {
  GRID_WIDTH_PX,
  PX_PER_MINUTE,
  hoursLabels,
} from '@/lib/film/schedule-geometry';

export default function ScheduleTimeAxis() {
  const labels = hoursLabels();
  return (
    <div
      className="sticky top-0 z-10 h-8 border-b border-[var(--twilight)] bg-[var(--night)]/95 backdrop-blur-sm"
      style={{ width: `${GRID_WIDTH_PX}px` }}
    >
      {labels.map((h) => (
        <span
          key={h.minutes}
          data-hour-label
          style={{ left: `${h.minutes * PX_PER_MINUTE}px` }}
          className="absolute top-1.5 pl-1 font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]"
        >
          {h.label}
        </span>
      ))}
      {labels.map((h) => (
        <span
          key={`tick-${h.minutes}`}
          style={{ left: `${h.minutes * PX_PER_MINUTE}px` }}
          className="absolute bottom-0 w-px h-2 bg-[var(--twilight)]/60"
        />
      ))}
    </div>
  );
}
