"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { buildHeroTag } from '@/lib/film/hero-tags';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl } from '@/lib/entity-urls';
import type { FilmScreening, HeroReason } from '@/lib/film/types';

type Density = 'full' | 'half' | 'third';

const HEIGHT: Record<Density, string> = {
  full: 'h-[240px]',
  half: 'h-[220px]',
  third: 'h-[200px]',
};

const TITLE_SIZE: Record<Density, string> = {
  full: 'text-3xl',
  half: 'text-2xl',
  third: 'text-lg',
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function metaLine(screening: FilmScreening): string {
  const t0 = screening.times[0];
  if (!t0) return screening.venue.name;
  const d = new Date(t0.start_date + 'T00:00:00Z');
  const wd = WEEKDAY[d.getUTCDay()];
  const time = t0.start_time ? formatTime(t0.start_time) : '';
  const extra = screening.times.length - 1;
  const extraStr =
    extra > 0 ? ` · also ${extra} more ${extra === 1 ? 'date' : 'dates'}` : '';
  return `${screening.venue.name} · ${wd} ${time}${extraStr}`;
}

interface HeroTileProps {
  hero: FilmScreening & { hero_reason: HeroReason };
  portalSlug: string;
  density: Density;
}

export default function HeroTile({ hero, portalSlug, density }: HeroTileProps) {
  const tag = buildHeroTag(hero, hero.hero_reason);
  const href = buildSeriesUrl(hero.slug, portalSlug, 'film');

  return (
    <Link
      href={href}
      prefetch={false}
      className={`relative block overflow-hidden bg-[var(--night)] ${HEIGHT[density]} group`}
      aria-label={`${hero.title} at ${hero.venue.name}`}
    >
      {hero.image_url ? (
        <SmartImage
          src={hero.image_url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]" />
      )}

      {/* Bottom gradient for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[var(--void)]/95 via-[var(--void)]/55 to-transparent" />

      {/* Top-left gold tag */}
      <span className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold tracking-[0.14em] uppercase">
        {tag.label}
      </span>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-3 space-y-1">
        {hero.film_press_quote && (
          <p className="text-xs italic text-[var(--cream)]/85 line-clamp-1">
            &ldquo;{hero.film_press_quote}&rdquo;
            {hero.film_press_source && (
              <span className="not-italic text-[var(--gold)]/80">
                {' '}
                &mdash; {hero.film_press_source}
              </span>
            )}
          </p>
        )}
        <h3
          className={`font-display font-semibold ${TITLE_SIZE[density]} text-[var(--cream)] leading-tight line-clamp-2`}
        >
          {hero.title}
        </h3>
        <p className="font-mono text-2xs text-[var(--cream)]/80 flex items-center gap-1.5 flex-wrap">
          <span className="truncate">{metaLine(hero)}</span>
          {hero.venue.founding_year && density !== 'third' && (
            <>
              <Dot />
              <span className="text-[var(--gold)]/80">
                est. {hero.venue.founding_year}
              </span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
