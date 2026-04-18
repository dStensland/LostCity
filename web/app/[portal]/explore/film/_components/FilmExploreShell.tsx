"use client";

import { useCallback, useState } from 'react';
import DateStrip from './DateStrip';
import ViewToggle, { type ExploreView } from './ViewToggle';
import FilmFilterChips, { DEFAULT_FILTERS, type FilmFilters } from './FilmFilterChips';
import ThisWeekZone from './ThisWeekZone';
import ByTheaterView from './ByTheaterView';
import type {
  ThisWeekPayload,
  TodayPlaybillPayload,
} from '@/lib/film/types';
import type { DateCount } from '@/lib/film/date-counts-loader';

interface FilmExploreShellProps {
  portalSlug: string;
  today: string;
  initialDate: string;
  initialCounts: DateCount[];
  initialThisWeek: ThisWeekPayload;
  initialPlaybill: TodayPlaybillPayload;
  editorialSubtitle: string | null;
}

export default function FilmExploreShell({
  portalSlug,
  today,
  initialDate,
  initialCounts,
  initialThisWeek,
  initialPlaybill,
  editorialSubtitle,
}: FilmExploreShellProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [view, setView] = useState<ExploreView>('by-theater');
  const [filters, setFilters] = useState<FilmFilters>(DEFAULT_FILTERS);
  const [playbill, setPlaybill] = useState<TodayPlaybillPayload>(initialPlaybill);
  const [loading, setLoading] = useState(false);

  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
      if (date === initialDate) {
        setPlaybill(initialPlaybill);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      setLoading(true);
      fetch(`/api/film/today-playbill?portal=${portalSlug}&date=${date}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<TodayPlaybillPayload>) : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((p) => setPlaybill(p))
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setPlaybill({
            portal_slug: portalSlug,
            date,
            total_screenings: 0,
            venues: [],
          });
        })
        .finally(() => {
          clearTimeout(timeoutId);
          setLoading(false);
        });
    },
    [portalSlug, initialDate, initialPlaybill],
  );

  // view is owned but only 'by-theater' ships a real view in this plan;
  // suppress unused-variable lint by referencing it in a render path guard.
  void view;

  return (
    <>
      <section className="space-y-1">
        <nav className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--vibe)]">
          Explore <span className="text-[var(--muted)] mx-1.5">/</span> Film
        </nav>
        <div className="flex items-end justify-between">
          <h1 className="font-display italic text-3xl sm:text-5xl font-semibold text-[var(--cream)]">
            Films Showing in Atlanta.
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            CURATED BY <span className="text-[var(--gold)]">Lost City Film</span>
          </span>
        </div>
        {editorialSubtitle && (
          <p className="text-sm sm:text-base italic text-[var(--soft)] pt-1">
            {editorialSubtitle}
          </p>
        )}
      </section>

      <DateStrip
        counts={initialCounts}
        selectedDate={selectedDate}
        today={today}
        onSelect={handleDateSelect}
      />

      <div className="flex items-center gap-4 flex-wrap">
        <ViewToggle view={view} onChange={setView} />
        <FilmFilterChips value={filters} onChange={setFilters} />
      </div>

      <ThisWeekZone thisWeek={initialThisWeek} portalSlug={portalSlug} />

      <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <ByTheaterView playbill={playbill} filters={filters} portalSlug={portalSlug} />
      </div>
    </>
  );
}
