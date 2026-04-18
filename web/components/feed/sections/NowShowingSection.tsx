"use client";

/**
 * NowShowingSection — two-zone editorial widget.
 *
 * Top: This Week headline strip (adaptive 0–3 hero tiles).
 * Bottom: Today typographic playbill (one row per venue with screenings today).
 *
 * Both zones are driven by Phase 1a film APIs:
 *   /api/film/this-week?portal={slug}
 *   /api/film/today-playbill?portal={slug}
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FilmSlate } from '@phosphor-icons/react';
import FeedSectionHeader from '@/components/feed/FeedSectionHeader';
import FeedSectionReveal from '@/components/feed/FeedSectionReveal';
import HeroTile from './now-showing/HeroTile';
import PlaybillRow from './now-showing/PlaybillRow';
import type {
  ThisWeekPayload,
  TodayPlaybillPayload,
} from '@/lib/film/types';

interface NowShowingSectionProps {
  portalSlug: string;
  embedded?: boolean;
}

type Density = 'full' | 'half' | 'third';

function densityFor(count: number): Density {
  if (count === 1) return 'full';
  if (count === 2) return 'half';
  return 'third';
}

function todayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function NowShowingSection({
  portalSlug,
  embedded = false,
}: NowShowingSectionProps) {
  const [thisWeek, setThisWeek] = useState<ThisWeekPayload | null>(null);
  const [today, setToday] = useState<TodayPlaybillPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    Promise.all([
      fetch(`/api/film/this-week?portal=${portalSlug}`, { signal: controller.signal }).then(
        (r) => (r.ok ? (r.json() as Promise<ThisWeekPayload>) : Promise.reject(new Error(`HTTP ${r.status}`))),
      ),
      fetch(`/api/film/today-playbill?portal=${portalSlug}`, { signal: controller.signal }).then(
        (r) => (r.ok ? (r.json() as Promise<TodayPlaybillPayload>) : Promise.reject(new Error(`HTTP ${r.status}`))),
      ),
    ])
      .then(([week, playbill]) => {
        if (controller.signal.aborted) return;
        setThisWeek(week);
        setToday(playbill);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setFailed(true);
        setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug]);

  const exploreHref = `/${portalSlug}/explore/film`;

  if (loading) {
    return (
      <div className={embedded ? '' : 'pb-2'}>
        {!embedded && (
          <FeedSectionHeader
            title="Now Showing"
            priority="secondary"
            variant="cinema"
            accentColor="var(--vibe)"
            icon={<FilmSlate weight="duotone" className="w-5 h-5" />}
            seeAllHref={exploreHref}
          />
        )}
        <div className="h-[220px] rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse" />
      </div>
    );
  }

  if (failed || (!thisWeek && !today)) return null;

  const heroes = thisWeek?.heroes ?? [];
  const venues = (today?.venues ?? []).filter((v) => v.screenings.length > 0);
  const totalScreenings = today?.total_screenings ?? 0;

  if (heroes.length === 0 && venues.length === 0) return null;

  const density = densityFor(heroes.length);

  const content = (
    <>
      {!embedded && (
        <FeedSectionHeader
          title="Now Showing"
          priority="secondary"
          variant="cinema"
          accentColor="var(--vibe)"
          icon={<FilmSlate weight="duotone" className="w-5 h-5" />}
          seeAllHref={exploreHref}
        />
      )}

      <p className="text-sm text-[var(--muted)] mb-4">
        {totalScreenings > 0
          ? `${totalScreenings} films showing in Atlanta tonight`
          : 'Quiet night \u2014 see what\u2019s opening this week'}
      </p>

      {heroes.length > 0 && (
        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
              This Week &middot; {heroes.length} Significant Screening{heroes.length === 1 ? '' : 's'}
            </span>
            <span className="text-xs italic text-[var(--muted)]">Not to miss.</span>
          </div>
          <div
            className={`grid gap-0 divide-x divide-[var(--void)] rounded-card overflow-hidden ${
              density === 'full'
                ? 'grid-cols-1'
                : density === 'half'
                  ? 'grid-cols-[3fr_2fr]'
                  : 'grid-cols-3'
            }`}
          >
            {heroes.map((hero) => (
              <HeroTile
                key={hero.run_id}
                hero={hero}
                portalSlug={portalSlug}
                density={density}
              />
            ))}
          </div>
        </div>
      )}

      {venues.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between pb-1.5 mb-1 border-b border-[var(--twilight)]">
            <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)]">
              Today &middot; {today ? todayLabel(today.date) : ''} &middot; {totalScreenings} screening
              {totalScreenings === 1 ? '' : 's'}
            </span>
          </div>
          <div className="space-y-0.5">
            {venues.map(({ venue, screenings }) => (
              <PlaybillRow
                key={venue.id}
                venue={venue}
                screenings={screenings}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </div>
      ) : heroes.length > 0 ? (
        <Link
          href={exploreHref}
          className="block py-3 text-sm italic text-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          Quiet night &mdash; see what&rsquo;s opening this week &rarr;
        </Link>
      ) : null}
    </>
  );

  return embedded ? <div>{content}</div> : <FeedSectionReveal className="pb-2">{content}</FeedSectionReveal>;
}
