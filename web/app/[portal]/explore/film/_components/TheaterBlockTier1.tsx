"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl, buildSpotUrl } from '@/lib/entity-urls';
import { buildHeroTag } from '@/lib/film/hero-tags';
import type { FilmScreening, FilmVenue } from '@/lib/film/types';

const MAX_SHOWN = 5;

function runtimeStr(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  venue: FilmVenue;
  screenings: FilmScreening[];
  portalSlug: string;
}

export default function TheaterBlockTier1({ venue, screenings, portalSlug }: Props) {
  const shown = screenings.slice(0, MAX_SHOWN);
  const overflow = Math.max(screenings.length - MAX_SHOWN, 0);

  return (
    <section className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] p-5 sm:p-6 space-y-4">
      <header className="flex items-end justify-between gap-4 pb-3 border-b border-[var(--twilight)]">
        <div>
          <Link
            href={buildSpotUrl(venue.slug, portalSlug, 'page')}
            className="inline-flex items-center gap-3 hover:text-[var(--vibe)] transition-colors"
          >
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cream)]">
              {venue.name}
            </h2>
            {venue.founding_year && (
              <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">
                EST. {venue.founding_year}
              </span>
            )}
          </Link>
          <p className="font-mono text-xs text-[var(--muted)] mt-1 flex items-center gap-1.5">
            {venue.neighborhood && <span>{venue.neighborhood}</span>}
            {venue.neighborhood && venue.google_rating != null && <Dot />}
            {venue.google_rating != null && (
              <span className="text-[var(--gold)]">{venue.google_rating.toFixed(1)} ★</span>
            )}
            <Dot />
            <span>{screenings.length} film{screenings.length === 1 ? '' : 's'}</span>
          </p>
        </div>
        <Link
          href={`/${portalSlug}/explore/film?venue=${venue.slug}`}
          className="font-mono text-xs text-[var(--vibe)] hover:text-[var(--cream)] transition-colors shrink-0"
        >
          See the week →
        </Link>
      </header>

      <div>
        {shown.map((s) => {
          const tag =
            s.is_curator_pick
              ? buildHeroTag(s, 'curator_pick')
              : s.is_premiere
                ? buildHeroTag(s, 'opens_this_week')
                : null;
          const meta = [
            s.director ? `Dir. ${s.director}` : null,
            s.year,
            runtimeStr(s.runtime_minutes),
            s.rating,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <article key={s.run_id} className="flex gap-4 py-3 border-b border-[var(--twilight)]/50 last:border-0">
              <Link
                href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                className="w-24 sm:w-[96px] h-[144px] rounded-card overflow-hidden flex-shrink-0 bg-[var(--dusk)] relative"
              >
                {s.image_url ? (
                  <SmartImage src={s.image_url} alt="" fill sizes="96px" className="object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                  className="font-display text-xl sm:text-2xl font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors"
                >
                  {s.title}
                </Link>
                {meta && <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{meta}</p>}
                {tag && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]">
                    {tag.label}
                  </span>
                )}
                {s.editorial_blurb && (
                  <p className="text-sm italic text-[var(--soft)] mt-1.5">{s.editorial_blurb}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {s.times.map((t) => (
                    <Link
                      key={t.id}
                      href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                      className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                    >
                      {t.start_time ? formatTime(t.start_time) : '—'}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {overflow > 0 && (
        <Link
          href={`/${portalSlug}/explore/film?venue=${venue.slug}`}
          className="block text-sm font-mono text-[var(--vibe)]/80 hover:text-[var(--vibe)] transition-colors"
        >
          +{overflow} more films tonight →
        </Link>
      )}
    </section>
  );
}
