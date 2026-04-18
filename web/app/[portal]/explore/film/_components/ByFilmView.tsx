"use client";

import { FilmSlate } from '@phosphor-icons/react';
import EditorialGroupHeader from './EditorialGroupHeader';
import FilmCard from './FilmCard';
import type { FilmFilters } from './FilmFilterChips';
import type { ByFilmPayload, EditorialGroup, FilmByFilmEntry } from '@/lib/film/types';

const GROUP_ORDER: EditorialGroup[] = ['opens', 'now', 'closes'];

function entryPassesFilters(e: FilmByFilmEntry, f: FilmFilters): boolean {
  if (f.premieresOnly && !e.film.is_premiere) return false;
  if (f.driveIn && !e.venues.some((v) => v.venue.programming_style === 'drive_in')) return false;
  if (f.formats.length > 0) {
    const allFormats = new Set(e.venues.flatMap((v) => v.times.flatMap((t) => t.format_labels)));
    if (!f.formats.some((ff) => allFormats.has(ff))) return false;
  }
  // festival + oneNightOnly no-op on this view — FilmByFilmEntry doesn't carry festival_id
  // or run-length fields. These filters effectively pass through so users aren't surprised
  // by zero results when both views are active. A future cleanup can deduplicate predicates
  // into web/lib/film/filter-predicates.ts once ByFilmEntry carries those fields.
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

interface Props {
  payload: ByFilmPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ByFilmView({ payload, filters, portalSlug }: Props) {
  if (payload.films.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto" />
        <h3 className="text-xl font-display text-[var(--cream)]">No screenings on this date.</h3>
        <p className="text-sm text-[var(--muted)]">Try another day from the strip above.</p>
      </div>
    );
  }

  const filtered = payload.films.filter((e) => entryPassesFilters(e, filters));

  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm italic text-[var(--muted)]">No films match your filters.</p>
      </div>
    );
  }

  const byGroup = new Map<EditorialGroup, FilmByFilmEntry[]>();
  for (const g of GROUP_ORDER) byGroup.set(g, []);
  for (const e of filtered) byGroup.get(e.editorial_group)!.push(e);

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            By Film · {prettyDate(payload.date).toUpperCase()} · {filtered.length} FILM
            {filtered.length === 1 ? '' : 'S'}
          </span>
          <p className="text-sm italic text-[var(--soft)] mt-0.5">
            Every film showing in Atlanta, tonight.
          </p>
        </div>
      </header>

      {GROUP_ORDER.map((g) => {
        const entries = byGroup.get(g)!;
        if (entries.length === 0) return null;
        return (
          <section key={g} className="space-y-3">
            <EditorialGroupHeader group={g} count={entries.length} />
            <div className="space-y-3">
              {entries.map((e) => (
                <FilmCard key={e.film.screening_title_id} entry={e} portalSlug={portalSlug} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
