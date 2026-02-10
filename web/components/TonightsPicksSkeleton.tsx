"use client";

import Skeleton from "@/components/Skeleton";

export default function TonightsPicksSkeleton() {
  return (
    <section className="py-8 -mx-4 px-4 mb-6 relative overflow-hidden">
      {/* Subtle atmospheric background */}
      <div className="absolute inset-0 opacity-20 tonight-picks-glow" />

      <div className="relative max-w-3xl mx-auto">
        {/* Tab bar skeleton */}
        <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 h-9 skeleton-shimmer rounded-lg" />
          ))}
        </div>

        {/* Section header skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full skeleton-shimmer" />
          <div>
            <div className="h-5 w-32 rounded skeleton-shimmer mb-1" />
            <Skeleton className="h-3 w-44 rounded" delay="0.05s" />
          </div>
        </div>

        {/* Hero card skeleton */}
        <div
          className="rounded-2xl overflow-hidden mb-4 relative bg-[var(--dusk)]"
        >
          {/* Gradient overlay like real component */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <div className="relative p-5 pt-32">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-16 rounded-full skeleton-shimmer" />
              <Skeleton className="h-5 w-14 rounded-full" delay="0.05s" />
            </div>
            {/* Title */}
            <Skeleton className="h-6 w-3/4 rounded mb-2" delay="0.1s" />
            {/* Meta */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12 rounded" delay="0.15s" />
              <Skeleton className="h-4 w-24 rounded" delay="0.2s" />
            </div>
          </div>
        </div>

        {/* Carousel thumbnails skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--twilight)] bg-[var(--dusk)] overflow-hidden"
            >
              <div className="h-24 skeleton-shimmer" />
              <div className="p-3">
                <Skeleton className="h-3 w-10 rounded mb-2" delay={`${i * 0.05 + 0.25}s`} />
                <Skeleton className="h-4 w-full rounded mb-1" delay={`${i * 0.05 + 0.3}s`} />
                <Skeleton className="h-4 w-2/3 rounded" delay={`${i * 0.05 + 0.35}s`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
