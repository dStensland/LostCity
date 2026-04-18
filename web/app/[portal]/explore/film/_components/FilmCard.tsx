"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl, buildSpotUrl } from '@/lib/entity-urls';
import { buildHeroTag } from '@/lib/film/hero-tags';
import type { FilmByFilmEntry, FilmScreening, FormatToken } from '@/lib/film/types';

const FORMAT_LABEL: Partial<Record<FormatToken, string>> = {
  true_imax: 'TRUE IMAX',
  imax: 'IMAX',
  dolby_cinema: 'DOLBY CINEMA',
  '4dx': '4DX',
  screenx: 'SCREENX',
  rpx: 'RPX',
  '70mm': '70MM',
  '35mm': '35MM',
};

function runtimeStr(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildBadgeFromEntry(entry: FilmByFilmEntry) {
  if (!entry.film.is_premiere && !entry.venues.some((v) => v.times.some((t) => t.format_labels.length > 0))) {
    return null;
  }
  const firstVenue = entry.venues[0];
  const firstTime = firstVenue?.times[0];
  if (!firstVenue || !firstTime) return null;
  const pseudo: FilmScreening = {
    run_id: 'pseudo',
    screening_title_id: entry.film.screening_title_id,
    title: entry.film.title,
    slug: entry.film.slug,
    director: entry.film.director,
    year: entry.film.year,
    runtime_minutes: entry.film.runtime_minutes,
    rating: entry.film.rating,
    image_url: entry.film.image_url,
    editorial_blurb: entry.film.editorial_blurb,
    film_press_quote: entry.film.film_press_quote,
    film_press_source: entry.film.film_press_source,
    is_premiere: entry.film.is_premiere,
    premiere_scope: entry.film.premiere_scope,
    is_curator_pick: false,
    festival_id: null,
    festival_name: null,
    venue: firstVenue.venue,
    times: [
      {
        id: firstTime.id,
        start_date: firstTime.start_date,
        start_time: firstTime.start_time,
        end_time: null,
        format_labels: firstTime.format_labels,
        status: firstTime.status,
        ticket_url: null,
        event_id: null,
      },
    ],
  };
  if (entry.film.is_premiere) return buildHeroTag(pseudo, 'opens_this_week');
  if (firstTime.format_labels.length > 0) return buildHeroTag(pseudo, 'special_format');
  return null;
}

interface Props {
  entry: FilmByFilmEntry;
  portalSlug: string;
}

export default function FilmCard({ entry, portalSlug }: Props) {
  const filmUrl = buildSeriesUrl(entry.film.slug, portalSlug, 'film');
  const meta = [
    entry.film.director ? `Dir. ${entry.film.director}` : null,
    entry.film.year,
    runtimeStr(entry.film.runtime_minutes),
    entry.film.rating,
  ]
    .filter(Boolean)
    .join(' · ');
  const badge = buildBadgeFromEntry(entry);

  return (
    <article className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] overflow-hidden flex flex-col md:flex-row">
      <Link
        href={filmUrl}
        className="relative w-full md:w-[320px] aspect-[16/9] flex-shrink-0 bg-[var(--dusk)]"
      >
        {entry.film.image_url ? (
          <SmartImage
            src={entry.film.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="flex-1 p-4 sm:p-5 min-w-0 space-y-2.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={filmUrl}
              className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors block truncate"
            >
              {entry.film.title}
            </Link>
            {meta && (
              <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{meta}</p>
            )}
          </div>
          {badge && (
            <span className="shrink-0 px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]">
              {badge.label}
            </span>
          )}
        </div>

        {entry.film.editorial_blurb && (
          <p className="text-sm italic text-[var(--soft)]">{entry.film.editorial_blurb}</p>
        )}

        {entry.film.film_press_quote && (
          <p className="text-sm italic text-[var(--cream)]/90">
            &ldquo;{entry.film.film_press_quote}&rdquo;
            {entry.film.film_press_source && (
              <span className="not-italic text-[var(--gold)]/80"> &mdash; {entry.film.film_press_source}</span>
            )}
          </p>
        )}

        <div className="pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Playing at
            </span>
            <span className="flex-1 h-px bg-[var(--twilight)]" />
          </div>
          {entry.venues.map(({ venue, times }) => {
            const isPremiumFormat = venue.classification === 'premium_format';
            const standardTimes = isPremiumFormat
              ? times.filter((t) => t.format_labels.length === 0)
              : [];
            const premiumTimes = isPremiumFormat
              ? times.filter((t) => t.format_labels.length > 0)
              : times;
            const collapseStandard = isPremiumFormat && standardTimes.length >= 2;

            return (
              <div key={venue.id} className="flex items-center justify-between gap-3 py-1">
                <Link
                  href={buildSpotUrl(venue.slug, portalSlug, 'page')}
                  className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--cream)] hover:text-[var(--vibe)] transition-colors shrink-0"
                >
                  {venue.name}
                </Link>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {premiumTimes.map((t) => {
                    const fmt = t.format_labels[0];
                    return (
                      <Link
                        key={t.id}
                        href={filmUrl}
                        className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                      >
                        {t.start_time ? formatTime(t.start_time) : '—'}
                        {fmt && (
                          <span className="text-2xs ml-1 text-[var(--gold)]">
                            {FORMAT_LABEL[fmt] ?? fmt.toUpperCase()}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {collapseStandard && (
                    <Link
                      href={filmUrl}
                      className="px-2 py-0.5 rounded border border-[var(--twilight)] text-[var(--muted)] font-mono text-xs hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
                    >
                      + {standardTimes.length} standard showings &rarr;
                    </Link>
                  )}
                  {isPremiumFormat && !collapseStandard &&
                    standardTimes.map((t) => (
                      <Link
                        key={t.id}
                        href={filmUrl}
                        className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                      >
                        {t.start_time ? formatTime(t.start_time) : '—'}
                      </Link>
                    ))}
                </div>
                <Dot className="hidden" aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
