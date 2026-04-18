"use client";

import { useCallback, useEffect, useState } from 'react';
import DateStrip from './DateStrip';
import ViewToggle, { type ExploreView } from './ViewToggle';
import FilmFilterChips, { DEFAULT_FILTERS, type FilmFilters } from './FilmFilterChips';
import ThisWeekZone from './ThisWeekZone';
import ByTheaterView from './ByTheaterView';
import ByFilmView from './ByFilmView';
import type {
  ByFilmPayload,
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

  const [byFilm, setByFilm] = useState<ByFilmPayload | null>(null);
  const [byFilmLoading, setByFilmLoading] = useState(false);

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

  useEffect(() => {
    if (view !== 'by-film') return;
    const date = selectedDate;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag before async fetch; cascade bounded (setByFilm only called in .then/.catch)
    setByFilmLoading(true);
    fetch(`/api/film/by-film?portal=${portalSlug}&date=${date}`, {
      signal: controller.signal,
    })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<ByFilmPayload>)
          : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((p) => setByFilm(p))
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setByFilm({
          portal_slug: portalSlug,
          date,
          iso_week_start: '',
          iso_week_end: '',
          films: [],
          total_screenings: 0,
        });
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setByFilmLoading(false);
      });
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [view, selectedDate, portalSlug]);

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

      <div className={(loading || byFilmLoading) ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {view === 'by-film' ? (
          byFilm ? (
            <ByFilmView payload={byFilm} filters={filters} portalSlug={portalSlug} />
          ) : (
            <div className="h-48 rounded-card-xl bg-[var(--night)] border border-[var(--twilight)] animate-pulse" />
          )
        ) : (
          <ByTheaterView playbill={playbill} filters={filters} portalSlug={portalSlug} />
        )}
      </div>
    </>
  );
}
