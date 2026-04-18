"use client";

/**
 * ThisWeekStrip — image-first carousel of 1–5 films worth seeing this week.
 *
 * The single view a hip consumer app would use for "what's on film this week."
 * Used by the feed widget (variant="feed", capped to 3 tiles) and by the
 * /explore?lane=shows&tab=film top strip (variant="lane", up to 5 tiles).
 *
 * Rules:
 * - Images carry the visual weight. No gold borders on rest state.
 * - One meta unit per tile: tag chip OR time anchor, never both.
 * - No press quote, no founding year, no stacked mono-caps labels.
 * - 0 heroes → component returns null.
 *
 * Copy discipline: meta reads "Thu at Plaza" not "Opens Thu · Plaza Theatre".
 */

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import { buildSeriesUrl } from '@/lib/entity-urls';
import type {
  FilmScreening,
  HeroReason,
  FormatToken,
} from '@/lib/film/types';

export type Hero = FilmScreening & { hero_reason: HeroReason };

export type ThisWeekStripVariant = 'feed' | 'lane';

interface Props {
  heroes: Hero[];
  portalSlug: string;
  variant: ThisWeekStripVariant;
}

// Weekday short form — "Thu", "Sat", etc.
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00Z');
  return WEEKDAY_SHORT[d.getUTCDay()] ?? null;
}

function shortVenue(name: string): string {
  return name
    .replace(/^(AMC|Regal|Cinemark|The)\s+/i, '')
    .replace(/\s+(Theatre|Theater|Cinema|Cinemas)$/i, '')
    .trim();
}

type TileMeta =
  | { kind: 'tag'; label: string }
  | { kind: 'time'; label: string };

// Pick ONE meta unit per tile. Tag chip wins when the film has a real
// editorial signal worth naming; otherwise show a time anchor.
function pickMeta(hero: Hero): TileMeta | null {
  // Tag wins
  if (hero.is_premiere) return { kind: 'tag', label: 'Premiere' };
  const firstFormat: FormatToken | undefined = hero.times[0]?.format_labels[0];
  if (firstFormat === 'true_imax') return { kind: 'tag', label: 'True IMAX' };
  if (firstFormat === '70mm') return { kind: 'tag', label: '70mm' };
  if (firstFormat === '35mm') return { kind: 'tag', label: '35mm' };
  if (hero.hero_reason === 'closes_this_week') {
    const wd = weekdayOf(hero.times[0]?.start_date);
    return { kind: 'tag', label: wd ? `Last chance · ${wd}` : 'Last chance' };
  }

  // Otherwise time anchor: "Thu at Plaza"
  const wd = weekdayOf(hero.times[0]?.start_date);
  const venue = shortVenue(hero.venue.name);
  if (wd) return { kind: 'time', label: `${wd} at ${venue}` };
  return { kind: 'time', label: venue };
}

function Tile({
  hero,
  portalSlug,
  variant,
  span,
}: {
  hero: Hero;
  portalSlug: string;
  variant: ThisWeekStripVariant;
  span: 'full' | 'split' | 'third';
}) {
  const href = buildSeriesUrl(hero.slug, portalSlug, 'film');
  const meta = pickMeta(hero);

  // Title sizing tracks (variant × span). Feed is one size denser than Lane.
  const titleSizeClass =
    variant === 'lane'
      ? span === 'full'
        ? 'text-3xl sm:text-4xl'
        : span === 'split'
          ? 'text-2xl sm:text-3xl'
          : 'text-xl sm:text-2xl'
      : span === 'full'
        ? 'text-2xl'
        : span === 'split'
          ? 'text-xl'
          : 'text-lg';

  const aspectClass =
    variant === 'lane'
      ? span === 'full'
        ? 'aspect-[21/9]'
        : span === 'split'
          ? 'aspect-[5/4]'
          : 'aspect-[4/5]'
      : span === 'full'
        ? 'aspect-[16/9]'
        : 'aspect-[3/4]';

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`${hero.title} at ${hero.venue.name}`}
      className={`group relative block overflow-hidden rounded-card bg-[var(--night)] ${aspectClass}`}
    >
      {hero.image_url ? (
        <SmartImage
          src={hero.image_url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]" />
      )}

      {/* Legibility gradient — only as much as the title needs */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--void)] via-[var(--void)]/70 to-transparent" />

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 space-y-1.5">
        <h3
          className={`font-display font-semibold ${titleSizeClass} text-[var(--cream)] leading-[1.1] line-clamp-2`}
        >
          {hero.title}
        </h3>
        {meta && meta.kind === 'tag' && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] text-xs font-medium">
            {meta.label}
          </span>
        )}
        {meta && meta.kind === 'time' && (
          <p className="text-sm text-[var(--cream)]/80">{meta.label}</p>
        )}
      </div>
    </Link>
  );
}

export default function ThisWeekStrip({ heroes, portalSlug, variant }: Props) {
  if (heroes.length === 0) return null;

  const cap = variant === 'feed' ? 3 : 5;
  const items = heroes.slice(0, cap);
  const n = items.length;

  // Layout — adaptive by count.
  //   1 → full-bleed
  //   2 → 2-column split
  //   3 → 3-column thirds
  //   4-5 (lane only) → horizontal scroll
  if (n === 1) {
    return (
      <div>
        <Tile hero={items[0]} portalSlug={portalSlug} variant={variant} span="full" />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {items.map((h) => (
          <Tile key={h.run_id} hero={h} portalSlug={portalSlug} variant={variant} span="split" />
        ))}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {items.map((h) => (
          <Tile key={h.run_id} hero={h} portalSlug={portalSlug} variant={variant} span="third" />
        ))}
      </div>
    );
  }

  // 4-5 — scroll on mobile, grid on desktop
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory sm:grid sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
      {items.map((h) => (
        <div
          key={h.run_id}
          className="flex-shrink-0 w-[72%] sm:w-auto snap-start"
        >
          <Tile hero={h} portalSlug={portalSlug} variant={variant} span="third" />
        </div>
      ))}
    </div>
  );
}
