import { Suspense } from "react";
import FeedView from "@/components/FeedView";
import TonightsPicks from "@/components/TonightsPicks";
import TrendingNow from "@/components/TrendingNow";
import TonightsPicksSkeleton from "@/components/TonightsPicksSkeleton";
import TrendingNowSkeleton from "@/components/TrendingNowSkeleton";
import HappeningNowCTA from "./HappeningNowCTA";

interface CuratedContentProps {
  portalSlug: string;
}

export default function CuratedContent({ portalSlug }: CuratedContentProps) {
  return (
    <div>
      {/* Happening Now CTA */}
      <Suspense fallback={null}>
        <HappeningNowCTA portalSlug={portalSlug} />
      </Suspense>

      {/* Tonight's Picks */}
      <Suspense fallback={<TonightsPicksSkeleton />}>
        <TonightsPicks portalSlug={portalSlug} />
      </Suspense>

      {/* Trending Now */}
      <Suspense fallback={<TrendingNowSkeleton />}>
        <TrendingNow portalSlug={portalSlug} />
      </Suspense>

      {/* Main Feed */}
      <Suspense fallback={null}>
        <FeedView />
      </Suspense>
    </div>
  );
}
