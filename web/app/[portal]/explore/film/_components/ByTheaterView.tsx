"use client";

import { FilmSlate } from '@phosphor-icons/react';
import TheaterBlockTier1 from './TheaterBlockTier1';
import TheaterBlockTier2 from './TheaterBlockTier2';
import type { FilmFilters } from './FilmFilterChips';
import type { FilmScreening, TodayPlaybillPayload } from '@/lib/film/types';

function screeningPassesFilters(s: FilmScreening, f: FilmFilters): boolean {
  if (f.premieresOnly && !s.is_premiere) return false;
  if (f.festival && !s.festival_id) return false;
  if (f.oneNightOnly && s.times.length > 1) return false;
  if (f.driveIn && s.venue.programming_style !== 'drive_in') return false;
  if (f.formats.length > 0) {
    const screeningFormats = new Set(s.times.flatMap((t) => t.format_labels));
    const any = f.formats.some((ff) => screeningFormats.has(ff));
    if (!any) return false;
  }
  return true;
}

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface ByTheaterViewProps {
  playbill: TodayPlaybillPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ByTheaterView({ playbill, filters, portalSlug }: ByTheaterViewProps) {
  const filteredVenues = playbill.venues
    .map(({ venue, screenings }) => ({
      venue,
      screenings: screenings.filter((s) => screeningPassesFilters(s, filters)),
    }))
    .filter(({ screenings }) => screenings.length > 0);

  if (playbill.venues.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto" />
        <h3 className="text-xl font-display text-[var(--cream)]">No screenings on this date.</h3>
        <p className="text-sm text-[var(--muted)]">Try another day from the strip above.</p>
      </div>
    );
  }

  if (filteredVenues.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm italic text-[var(--muted)]">
          No screenings match your filters.
        </p>
      </div>
    );
  }

  const tier1 = filteredVenues.filter((v) => v.venue.classification === 'editorial_program');
  const tier2 = filteredVenues.filter((v) => v.venue.classification === 'premium_format');
  const total = filteredVenues.reduce((n, v) => n + v.screenings.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            By Theater · {prettyDate(playbill.date).toUpperCase()}
          </span>
          <p className="text-sm italic text-[var(--soft)] mt-0.5">
            Atlanta&apos;s programs tonight.
          </p>
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">
          {tier1.length} ind{tier1.length === 1 ? 'ie' : 'ies'} + {tier2.length} premium screen
          {tier2.length === 1 ? '' : 's'} · {total} screening{total === 1 ? '' : 's'}
        </span>
      </header>

      <div className="space-y-4">
        {tier1.map(({ venue, screenings }) => (
          <TheaterBlockTier1 key={venue.id} venue={venue} screenings={screenings} portalSlug={portalSlug} />
        ))}
      </div>

      {tier2.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-[var(--twilight)]" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Premium Formats
            </span>
            <span className="flex-1 h-px bg-[var(--twilight)]" />
          </div>
          <div className="space-y-4">
            {tier2.map(({ venue, screenings }) => (
              <TheaterBlockTier2 key={venue.id} venue={venue} screenings={screenings} portalSlug={portalSlug} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
