import { Suspense } from "react";
import GlassHeader from "@/components/GlassHeader";

export default function SpotsLoading() {
  return (
    <div className="min-h-screen bg-[var(--void)]">
      <Suspense fallback={<div className="h-14 bg-transparent" />}>
        <GlassHeader />
      </Suspense>

      {/* Nav skeleton */}
      <div className="h-10 bg-[var(--night)] border-b border-[var(--twilight)]" />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-32 bg-[var(--twilight)] rounded skeleton-shimmer mb-2" />
          <div className="h-4 w-64 bg-[var(--twilight)] rounded skeleton-shimmer" />
        </div>

        {/* Filter bar skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-24 bg-[var(--twilight)] rounded-lg skeleton-shimmer flex-shrink-0" />
          ))}
        </div>

        {/* Search bar skeleton */}
        <div className="h-11 bg-[var(--twilight)] rounded-lg skeleton-shimmer mb-8" />

        {/* View mode tabs skeleton */}
        <div className="flex gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-28 bg-[var(--twilight)] rounded skeleton-shimmer" />
          ))}
        </div>

        {/* Spots grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]"
            >
              {/* Spot image skeleton */}
              <div className="h-32 rounded-lg bg-[var(--twilight)] skeleton-shimmer mb-3" />

              {/* Spot name skeleton */}
              <div className="h-5 w-3/4 bg-[var(--twilight)] rounded skeleton-shimmer mb-2" />

              {/* Type badge skeleton */}
              <div className="h-5 w-20 bg-[var(--twilight)] rounded-full skeleton-shimmer mb-2" />

              {/* Location skeleton */}
              <div className="h-4 w-1/2 bg-[var(--twilight)] rounded skeleton-shimmer mb-3" />

              {/* Stats skeleton */}
              <div className="flex gap-4">
                <div className="h-4 w-16 bg-[var(--twilight)] rounded skeleton-shimmer" />
                <div className="h-4 w-20 bg-[var(--twilight)] rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
