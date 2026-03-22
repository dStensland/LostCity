"use client";

import Skeleton from "@/components/Skeleton";

export default function SpotLoading() {
  return (
    <div data-skeleton-route="spot-detail" className="min-h-screen">
      <main
        className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-8 animate-fade-in"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        {/* Hero image skeleton */}
        <div className="aspect-[16/9] bg-[var(--twilight)]/30 rounded-lg skeleton-shimmer" />

        {/* Identity strip — vibes + actions */}
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" delay={`${i * 0.04}s`} />
          ))}
          <Skeleton className="h-8 w-8 rounded-full" delay="0.16s" />
          <Skeleton className="h-8 w-8 rounded-full" delay="0.2s" />
        </div>

        {/* MetadataGrid skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg p-3 sm:p-4 border border-[var(--twilight)] bg-[var(--void)]"
            >
              <Skeleton className="h-3 w-10 mx-auto rounded mb-2" delay={`${i * 0.05}s`} />
              <Skeleton className="h-5 w-14 mx-auto rounded" delay={`${i * 0.05 + 0.05}s`} />
            </div>
          ))}
        </div>

        {/* About card skeleton */}
        <div className="border border-[var(--twilight)] rounded-lg p-6 sm:p-8 bg-[var(--card-bg)]">
          <Skeleton className="h-3 w-12 rounded mb-4" delay="0.15s" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded" delay="0.2s" />
            <Skeleton className="h-4 w-full rounded" delay="0.25s" />
            <Skeleton className="h-4 w-3/4 rounded" delay="0.3s" />
          </div>
        </div>

        {/* Hours + Location card skeleton */}
        <div className="border border-[var(--twilight)] rounded-lg p-6 sm:p-8 bg-[var(--card-bg)]">
          <Skeleton className="h-3 w-10 rounded mb-4" delay="0.35s" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded" delay="0.4s" />
            <Skeleton className="h-4 w-40 rounded" delay="0.45s" />
          </div>
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <Skeleton className="h-3 w-14 rounded mb-3" delay="0.5s" />
            <Skeleton className="h-4 w-48 rounded mb-1" delay="0.55s" />
            <Skeleton className="h-4 w-56 rounded" delay="0.6s" />
          </div>
        </div>
      </main>
    </div>
  );
}
