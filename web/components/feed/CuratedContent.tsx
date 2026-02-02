import { Suspense } from "react";
import FeedView from "@/components/FeedView";
import TonightsPicks from "@/components/TonightsPicks";
import TrendingNow from "@/components/TrendingNow";
import TonightsPicksSkeleton from "@/components/TonightsPicksSkeleton";
import TrendingNowSkeleton from "@/components/TrendingNowSkeleton";
import HappeningNowCTA from "./HappeningNowCTA";
import BrowseByActivity from "@/components/BrowseByActivity";

interface CuratedContentProps {
  portalSlug: string;
}

export default function CuratedContent({ portalSlug }: CuratedContentProps) {
  return (
    <div className="space-y-2">
      {/* Above-fold: Happening Now CTA - Priority load */}
      <Suspense fallback={null}>
        <HappeningNowCTA portalSlug={portalSlug} />
      </Suspense>

      {/* Above-fold: Tonight's Picks - Critical content */}
      <Suspense fallback={<TonightsPicksSkeleton />}>
        <TonightsPicks portalSlug={portalSlug} />
      </Suspense>

      {/* Above-fold: Trending Now - High priority */}
      <Suspense fallback={<TrendingNowSkeleton />}>
        <TrendingNow portalSlug={portalSlug} />
      </Suspense>

      {/* Section divider for visual breathing room */}
      <div className="h-4" />

      {/* Below-fold: Browse by Activity - Lazy loaded */}
      <Suspense fallback={<BrowseByActivitySkeleton />}>
        <BrowseByActivity portalSlug={portalSlug} />
      </Suspense>

      {/* Section divider */}
      <div className="h-4" />

      {/* Below-fold: Main Feed - Deferred load */}
      <Suspense fallback={<FeedViewSkeleton />}>
        <FeedView />
      </Suspense>
    </div>
  );
}

// Skeleton loaders for better perceived performance
function BrowseByActivitySkeleton() {
  return (
    <section className="py-6">
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
    <div className="space-y-4 py-6">
      <div className="h-6 w-48 skeleton-shimmer rounded mb-4" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 skeleton-shimmer rounded-xl" />
      ))}
    </div>
  );
}
