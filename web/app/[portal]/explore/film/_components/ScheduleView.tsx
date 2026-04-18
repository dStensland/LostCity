"use client";

import ScheduleGrid from './schedule/ScheduleGrid';
import type { FilmFilters } from './FilmFilterChips';
import type { TodayPlaybillPayload } from '@/lib/film/types';

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface Props {
  playbill: TodayPlaybillPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ScheduleView({ playbill, filters, portalSlug }: Props) {
  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Schedule · {prettyDate(playbill.date).toUpperCase()}
          </span>
          <p className="text-sm italic text-[var(--soft)] mt-0.5">
            A print-style grid — scroll right for later tonight.
          </p>
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">
          {playbill.total_screenings} screening{playbill.total_screenings === 1 ? '' : 's'}
        </span>
      </header>
      <ScheduleGrid playbill={playbill} filters={filters} portalSlug={portalSlug} />
    </div>
  );
}
