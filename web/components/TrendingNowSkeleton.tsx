"use client";

import Skeleton from "@/components/Skeleton";

export default function TrendingNowSkeleton() {
  return (
    <section className="py-4 border-b border-[var(--twilight)]">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded skeleton-shimmer" />
        <Skeleton className="h-3 w-24 rounded" delay="0.05s" />
        <Skeleton className="h-4 w-8 rounded" delay="0.1s" />
      </div>

      {/* Horizontal scroll cards skeleton */}
      <div className="flex gap-3 overflow-hidden -mx-4 px-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-72 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]"
          >
            <div className="flex items-start gap-3">
              {/* Trending icon skeleton */}
              <div className="flex-shrink-0 w-10">
                <Skeleton className="w-8 h-8 rounded-full" delay={`${i * 0.08}s`} />
              </div>

              {/* Content skeleton */}
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-full rounded mb-1" delay={`${i * 0.08 + 0.05}s`} />
                <Skeleton className="h-4 w-3/4 rounded mb-2" delay={`${i * 0.08 + 0.1}s`} />

                <div className="flex items-center gap-1.5">
                  <Skeleton className="w-3 h-3 rounded-full" delay={`${i * 0.08 + 0.15}s`} />
                  <Skeleton className="h-3 w-24 rounded" delay={`${i * 0.08 + 0.2}s`} />
                </div>

                <Skeleton className="h-3 w-20 rounded mt-1" delay={`${i * 0.08 + 0.25}s`} />

                {/* Stats skeleton */}
                <div className="flex items-center gap-2 mt-2">
                  <Skeleton className="h-3 w-14 rounded" delay={`${i * 0.08 + 0.3}s`} />
                  <Skeleton className="h-3 w-16 rounded" delay={`${i * 0.08 + 0.35}s`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
