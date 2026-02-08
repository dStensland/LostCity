"use client";

import { Suspense, useState, useEffect, type ReactNode } from "react";
import FeedView from "@/components/FeedView";
import TonightsPicks from "@/components/TonightsPicks";
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

export default function CuratedContent({ portalSlug }: CuratedContentProps) {
  return (
    <div className="space-y-6">
      {/* Above-fold: Happening Now CTA - Priority load */}
      <Suspense fallback={null}>
        <HappeningNowCTA portalSlug={portalSlug} />
      </Suspense>

      {/* Holiday hero: Super Bowl, etc. — big feature when active */}
      <Suspense fallback={null}>
        <HolidayHero portalSlug={portalSlug} />
      </Suspense>

      {/* Above-fold: Tonight's Picks - Critical content */}
      <Suspense fallback={<DelayedFallback><TonightsPicksSkeleton /></DelayedFallback>}>
        <TonightsPicks portalSlug={portalSlug} />
      </Suspense>

      {/* Festival moments: takeover hero + imminent festivals */}
      <Suspense fallback={null}>
        <MomentsSection portalSlug={portalSlug} />
      </Suspense>

      {/* Time-of-day contextual section: "Patio SZN" / "After Hours" / "Brunch & Markets" */}
      <Suspense fallback={null}>
        <TimeContextSection portalSlug={portalSlug} />
      </Suspense>

      {/* Above-fold: Trending Now - High priority */}
      <Suspense fallback={<DelayedFallback><TrendingNowSkeleton /></DelayedFallback>}>
        <TrendingNow portalSlug={portalSlug} />
      </Suspense>

      {/* Below-fold: Main Feed - Deferred load */}
      <Suspense fallback={<DelayedFallback><FeedViewSkeleton /></DelayedFallback>}>
        <FeedView />
      </Suspense>

      {/* Below-fold: Browse by Activity - Lazy loaded */}
      <Suspense fallback={<DelayedFallback><BrowseByActivitySkeleton /></DelayedFallback>}>
        <BrowseByActivity portalSlug={portalSlug} />
      </Suspense>
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
