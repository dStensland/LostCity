"use client";

/**
 * NowShowingSection — feed widget for film.
 *
 * One zone: up to 3 image-first tiles of films worth seeing this week, linking
 * into /explore?lane=shows&tab=film for the full surface.
 *
 * Data: /api/film/this-week — editorial hero cascade (curator picks +
 * opens-this-week + special format + festival + closes-this-week).
 *
 * See elevate brief: docs/superpowers/specs/2026-04-18-shows-lane-elevate-brief.md
 */

import { useEffect, useState } from 'react';
import { FilmSlate } from '@phosphor-icons/react';
import FeedSectionHeader from '@/components/feed/FeedSectionHeader';
import FeedSectionReveal from '@/components/feed/FeedSectionReveal';
import ThisWeekStrip, { type Hero } from './now-showing/ThisWeekStrip';
import type { ThisWeekPayload } from '@/lib/film/types';

interface NowShowingSectionProps {
  portalSlug: string;
  /** When true, suppresses the section header — for embedding inside a tab shell */
  embedded?: boolean;
}

export default function NowShowingSection({
  portalSlug,
  embedded = false,
}: NowShowingSectionProps) {
  const [heroes, setHeroes] = useState<Hero[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    fetch(`/api/film/this-week?portal=${portalSlug}`, {
      signal: controller.signal,
    })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<ThisWeekPayload>)
          : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((payload) => {
        if (controller.signal.aborted) return;
        setHeroes(payload.heroes);
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

  const exploreHref = `/${portalSlug}/explore?lane=shows&tab=film`;

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
        <div className="aspect-[16/9] sm:aspect-[3/1] rounded-card bg-[var(--night)] animate-pulse" />
      </div>
    );
  }

  if (failed || !heroes || heroes.length === 0) return null;

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
      <ThisWeekStrip heroes={heroes} portalSlug={portalSlug} variant="feed" />
    </>
  );

  return embedded ? (
    <div>{content}</div>
  ) : (
    <FeedSectionReveal className="pb-2">{content}</FeedSectionReveal>
  );
}
