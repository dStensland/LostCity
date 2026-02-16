"use client";

import { Suspense, useState, useEffect, type ReactNode } from "react";
import FeedView from "@/components/FeedView";
import HighlightsPicks from "@/components/highlights/HighlightsPicks";
import TrendingNow from "@/components/TrendingNow";
import TonightsPicksSkeleton from "@/components/TonightsPicksSkeleton";
import TrendingNowSkeleton from "@/components/TrendingNowSkeleton";
import HappeningNowCTA from "./HappeningNowCTA";
import HolidayHero, { getActiveHeroSlugs } from "./HolidayHero";
import MomentsSection from "./MomentsSection";
import BrowseByActivity from "@/components/BrowseByActivity";
import SectionErrorBoundary from "./SectionErrorBoundary";
import { useCuratedFeedData } from "./useCuratedFeedData";

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

export default function CuratedContent({ portalSlug }: CuratedContentProps) {
  const { sections, moments, loading } = useCuratedFeedData(portalSlug);

  // Extract event counts for each HolidayHero from shared feed data
  const heroSlugs = getActiveHeroSlugs();
  function getEventCount(position: number): number | null {
    if (loading) return null;
    const slug = heroSlugs[position - 1];
    if (!slug) return null;
    const section = sections.find(s => s.slug === slug);
    return section?.events ? section.events.length : null;
  }

  return (
    <div className="space-y-6">
      {/* Above-fold: Happening Now CTA - Priority load */}
      <SectionErrorBoundary>
        <Suspense fallback={null}>
          <HappeningNowCTA portalSlug={portalSlug} />
        </Suspense>
      </SectionErrorBoundary>

      {/* Holiday hero: nearest event date gets top position */}
      <SectionErrorBoundary>
        <Suspense fallback={null}>
          <HolidayHero portalSlug={portalSlug} eventCount={getEventCount(1)} />
        </Suspense>
      </SectionErrorBoundary>

      {/* Above-fold: Tonight's Picks - Critical content */}
      <SectionErrorBoundary>
        <Suspense fallback={<DelayedFallback><TonightsPicksSkeleton /></DelayedFallback>}>
          <HighlightsPicks portalSlug={portalSlug} />
        </Suspense>
      </SectionErrorBoundary>

      <div className="pt-4 border-t border-[var(--twilight)]/40" />

      {/* Festival moments: takeover hero + imminent festivals */}
      <SectionErrorBoundary>
        <Suspense fallback={null}>
          <MomentsSection portalSlug={portalSlug} prefetchedData={moments} />
        </Suspense>
      </SectionErrorBoundary>

      {/* Second holiday hero (below festivals) */}
      <SectionErrorBoundary>
        <Suspense fallback={null}>
          <HolidayHero portalSlug={portalSlug} position={2} eventCount={getEventCount(2)} />
        </Suspense>
      </SectionErrorBoundary>

      {/* Above-fold: Trending Now - High priority */}
      <SectionErrorBoundary>
        <Suspense fallback={<DelayedFallback><TrendingNowSkeleton /></DelayedFallback>}>
          <TrendingNow portalSlug={portalSlug} />
        </Suspense>
      </SectionErrorBoundary>

      <div className="pt-4 border-t border-[var(--twilight)]/40" />

      {/* Below-fold: Main Feed - Deferred load */}
      <SectionErrorBoundary>
        {loading ? (
          <DelayedFallback><FeedViewSkeleton /></DelayedFallback>
        ) : (
          <FeedView prefetchedSections={sections} />
        )}
      </SectionErrorBoundary>

      {/* Below-fold: Browse by Activity - Lazy loaded */}
      <SectionErrorBoundary>
        <Suspense fallback={<DelayedFallback><BrowseByActivitySkeleton /></DelayedFallback>}>
          <BrowseByActivity portalSlug={portalSlug} />
        </Suspense>
      </SectionErrorBoundary>
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
    <div>
      {/* Matches actual FeedView: compact holiday rows + section headers */}
      <div className="mb-4">
        <div className="h-5 w-52 rounded skeleton-shimmer mb-3" />
        <div className="space-y-2">
          <div className="rounded-2xl h-[60px] skeleton-shimmer" />
          <div className="rounded-2xl h-[60px] skeleton-shimmer" />
        </div>
      </div>
      <div className="mb-4">
        <div className="h-5 w-32 rounded skeleton-shimmer mb-3" />
        <div className="space-y-2">
          <div className="rounded-xl h-16 skeleton-shimmer" />
          <div className="rounded-xl h-16 skeleton-shimmer" />
          <div className="rounded-xl h-16 skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
