"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl } from '@/lib/entity-urls';
import type { FilmScreening, FilmVenue, FormatToken } from '@/lib/film/types';

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

interface Props {
  venue: FilmVenue;
  screenings: FilmScreening[];
  portalSlug: string;
}

export default function TheaterBlockTier2({ venue, screenings, portalSlug }: Props) {
  return (
    <section className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] p-5 sm:p-6 space-y-3">
      <header>
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--cream)]">
          {venue.name}
        </h2>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {venue.venue_formats.map((f) => (
            <span
              key={f}
              className="px-2 py-0.5 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]"
            >
              {FORMAT_LABEL[f] ?? f.toUpperCase()}
            </span>
          ))}
        </div>
        <p className="font-mono text-xs text-[var(--muted)] mt-1.5 flex items-center gap-1.5">
          {venue.neighborhood && <span>{venue.neighborhood}</span>}
          {venue.neighborhood && <Dot />}
          <span>{screenings.length} film{screenings.length === 1 ? '' : 's'}</span>
        </p>
      </header>

      <div>
        {screenings.map((s) => {
          const meta = [s.runtime_minutes ? `${s.runtime_minutes}m` : null, s.rating]
            .filter(Boolean)
            .join(' · ');
          return (
            <article key={s.run_id} className="flex gap-3 py-2 border-b border-[var(--twilight)]/30 last:border-0">
              <Link
                href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                className="w-16 sm:w-[64px] h-[96px] rounded overflow-hidden flex-shrink-0 bg-[var(--dusk)] relative"
              >
                {s.image_url ? (
                  <SmartImage src={s.image_url} alt="" fill sizes="64px" className="object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                  className="text-base sm:text-lg font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors"
                >
                  {s.title}
                </Link>
                {meta && <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{meta}</p>}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {s.times.map((t) => {
                    const primaryFmt = t.format_labels[0];
                    const suffix = primaryFmt ? ` · ${FORMAT_LABEL[primaryFmt] ?? primaryFmt.toUpperCase()}` : '';
                    return (
                      <Link
                        key={t.id}
                        href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                        className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                      >
                        {t.start_time ? formatTime(t.start_time) : '—'}
                        {suffix && <span className="text-2xs ml-1 text-[var(--gold)]">{suffix}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
