"use client";

import UnifiedHeader from "@/components/UnifiedHeader";
import Skeleton from "@/components/Skeleton";
import { useParams } from "next/navigation";

export default function PortalLoading() {
  const params = useParams();
  const portalSlug = (params?.portal as string) || "atlanta";

  return (
    <div className="min-h-screen">
      <UnifiedHeader portalSlug={portalSlug} />

      <main className="max-w-3xl mx-auto px-4 pb-16">
        {/* Tonight's Picks skeleton */}
        <section className="py-6 -mx-4 px-4 mb-6 relative overflow-hidden">
          {/* Subtle atmospheric background */}
          <div
            className="absolute inset-0 opacity-20 portal-loading-glow"
          />

          <div className="relative">
            {/* Section header skeleton */}
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div>
                <Skeleton className="h-5 w-32 rounded mb-1" />
                <Skeleton className="h-3 w-44 rounded" delay="0.05s" />
              </div>
            </div>

            {/* Hero card skeleton */}
            <div className="rounded-2xl overflow-hidden mb-4 relative bg-[var(--dusk)]">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="relative p-5 pt-32">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" delay="0.05s" />
                </div>
                <Skeleton className="h-6 w-3/4 rounded mb-2" delay="0.1s" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12 rounded" delay="0.15s" />
                  <Skeleton className="h-4 w-24 rounded" delay="0.2s" />
                </div>
              </div>
            </div>

            {/* Secondary cards skeleton */}
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-[var(--twilight)] bg-[var(--dusk)]"
                >
                  <Skeleton className="h-3 w-10 rounded mb-2" delay={`${i * 0.05 + 0.25}s`} />
                  <Skeleton className="h-4 w-full rounded mb-1" delay={`${i * 0.05 + 0.3}s`} />
                  <Skeleton className="h-4 w-2/3 rounded mb-2" delay={`${i * 0.05 + 0.35}s`} />
                  <Skeleton className="h-3 w-1/2 rounded" delay={`${i * 0.05 + 0.4}s`} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Now skeleton */}
        <section className="py-4 border-b border-[var(--twilight)]">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-3 w-24 rounded" delay="0.5s" />
            <Skeleton className="h-4 w-8 rounded" delay="0.55s" />
          </div>

          <div className="flex gap-3 overflow-hidden -mx-4 px-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-72 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="flex-shrink-0 w-8 h-8 rounded-full" delay={`${i * 0.08 + 0.6}s`} />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-full rounded mb-1" delay={`${i * 0.08 + 0.65}s`} />
                    <Skeleton className="h-4 w-3/4 rounded mb-2" delay={`${i * 0.08 + 0.7}s`} />
                    <Skeleton className="h-3 w-24 rounded" delay={`${i * 0.08 + 0.75}s`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feed sections skeleton */}
        <div className="py-6 space-y-10">
          {/* Hero banner skeleton */}
          <Skeleton className="rounded-2xl h-56 sm:h-64" delay="0.9s" />

          {/* Carousel section skeleton */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-36 rounded" delay="1s" />
              <Skeleton className="h-6 w-16 rounded-full" delay="1.05s" />
            </div>
            <div className="flex gap-3 overflow-hidden -mx-4 px-4">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="flex-shrink-0 w-72 rounded-xl h-52" delay={`${j * 0.1 + 1.1}s`} />
              ))}
            </div>
          </div>

          {/* Grid section skeleton */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-32 rounded" delay="1.5s" />
              <Skeleton className="h-6 w-16 rounded-full" delay="1.55s" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="rounded-xl h-52" delay={`${j * 0.1 + 1.6}s`} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
