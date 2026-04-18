"use client";

import HeroTile from '@/components/feed/sections/now-showing/HeroTile';
import type { ThisWeekPayload } from '@/lib/film/types';

type Density = 'hero-large-full' | 'hero-large-half' | 'hero-large-third';

function densityFor(count: number): Density {
  if (count === 1) return 'hero-large-full';
  if (count === 2) return 'hero-large-half';
  return 'hero-large-third';
}

interface ThisWeekZoneProps {
  thisWeek: ThisWeekPayload;
  portalSlug: string;
}

export default function ThisWeekZone({ thisWeek, portalSlug }: ThisWeekZoneProps) {
  const heroes = thisWeek.heroes;
  if (heroes.length === 0) return null;

  const density = densityFor(heroes.length);
  const gridCols =
    heroes.length === 1
      ? 'grid-cols-1'
      : heroes.length === 2
        ? 'grid-cols-[3fr_2fr]'
        : 'grid-cols-3';

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">
          This Week · {heroes.length} Significant Screening{heroes.length === 1 ? '' : 's'}
        </span>
        <span className="text-xs italic text-[var(--muted)]">Not to miss.</span>
      </div>
      <div className={`grid gap-0 divide-x divide-[var(--void)] rounded-card overflow-hidden ${gridCols}`}>
        {heroes.map((hero) => (
          <HeroTile key={hero.run_id} hero={hero} portalSlug={portalSlug} density={density} />
        ))}
      </div>
    </section>
  );
}
