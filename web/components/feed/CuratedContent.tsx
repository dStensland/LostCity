"use client";

import { Suspense, useState, useEffect, type ReactNode } from "react";
import FeedView from "@/components/FeedView";
import HighlightsPicks from "@/components/highlights/HighlightsPicks";
import TrendingNow from "@/components/TrendingNow";
import TonightsPicksSkeleton from "@/components/TonightsPicksSkeleton";
import TrendingNowSkeleton from "@/components/TrendingNowSkeleton";
import HappeningNowCTA from "./HappeningNowCTA";
import HolidayHero from "./HolidayHero";
import MomentsSection from "./MomentsSection";
import TimeContextSection from "./TimeContextSection";
import BrowseByActivity from "@/components/BrowseByActivity";

/** Delays showing skeleton by `delay` ms so fast loads don't flash placeholders */
function DelayedFallback({ children, delay = 150 }: { children: ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return show ? <>{children}</> : null;
}

interface CuratedContentProps {
  portalSlug: string;
}

interface FeedBandProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}

function FeedBand({ eyebrow, title, subtitle, children, className = "" }: FeedBandProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[var(--muted)]">
            {eyebrow}
          </p>
          <h2 className="text-[clamp(1.15rem,2vw,1.65rem)] font-semibold tracking-tight text-[var(--cream)]">
            {title}
          </h2>
          <p className="text-[0.8rem] text-[var(--text-secondary)] mt-0.5">
            {subtitle}
          </p>
        </div>
      </header>
      <div className="space-y-5">
        {children}
      </div>
    </section>
  );
}

export default function CuratedContent({ portalSlug }: CuratedContentProps) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <FeedBand
        eyebrow="Now"
        title="Live Pulse"
        subtitle="What is active and worth opening right now."
      >
        {/* Above-fold: Happening Now CTA - Priority load */}
        <Suspense fallback={null}>
          <HappeningNowCTA portalSlug={portalSlug} />
        </Suspense>

        {/* Holiday hero: Valentine's Day at top (priority) */}
        <Suspense fallback={null}>
          <HolidayHero portalSlug={portalSlug} slug="valentines-day" />
        </Suspense>

        {/* Above-fold: Tonight's Picks - Critical content */}
        <Suspense fallback={<DelayedFallback><TonightsPicksSkeleton /></DelayedFallback>}>
          <HighlightsPicks portalSlug={portalSlug} />
        </Suspense>
      </FeedBand>

      <FeedBand
        eyebrow="Soon"
        title="Coming Up"
        subtitle="Contextual highlights for this week and seasonal moments."
        className="pt-4 border-t border-[var(--twilight)]/40"
      >
        {/* Festival moments: takeover hero + imminent festivals */}
        <Suspense fallback={null}>
          <MomentsSection portalSlug={portalSlug} />
        </Suspense>

        {/* Friday the 13th + other holidays (below festivals) */}
        <Suspense fallback={null}>
          <HolidayHero portalSlug={portalSlug} exclude={["valentines-day"]} />
        </Suspense>

        {/* Time-of-day contextual section: "Patio SZN" / "After Hours" / "Brunch & Markets" */}
        <Suspense fallback={null}>
          <TimeContextSection portalSlug={portalSlug} />
        </Suspense>

        {/* Above-fold: Trending Now - High priority */}
        <Suspense fallback={<DelayedFallback><TrendingNowSkeleton /></DelayedFallback>}>
          <TrendingNow portalSlug={portalSlug} />
        </Suspense>
      </FeedBand>

      <FeedBand
        eyebrow="Browse"
        title="Deep Dive"
        subtitle="Extended collections and category-driven exploration."
        className="pt-4 border-t border-[var(--twilight)]/40"
      >
        {/* Below-fold: Main Feed - Deferred load */}
        <Suspense fallback={<DelayedFallback><FeedViewSkeleton /></DelayedFallback>}>
          <FeedView />
        </Suspense>

        {/* Below-fold: Browse by Activity - Lazy loaded */}
        <Suspense fallback={<DelayedFallback><BrowseByActivitySkeleton /></DelayedFallback>}>
          <BrowseByActivity portalSlug={portalSlug} />
        </Suspense>
      </FeedBand>
    </div>
  );
}

// Skeleton loaders for better perceived performance
function BrowseByActivitySkeleton() {
  return (
    <section>
      <div className="h-6 w-64 skeleton-shimmer rounded mb-4" />
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 skeleton-shimmer rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    </section>
  );
}

function FeedViewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 skeleton-shimmer rounded mb-4" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 skeleton-shimmer rounded-xl" />
      ))}
    </div>
  );
}
