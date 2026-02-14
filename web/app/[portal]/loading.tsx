"use client";

import UnifiedHeader from "@/components/UnifiedHeader";
import Skeleton from "@/components/Skeleton";
import { useParams } from "next/navigation";
import { usePortalOptional } from "@/lib/portal-context";
import { resolveSkeletonVertical } from "@/lib/skeleton-contract";

export default function PortalLoading() {
  const params = useParams();
  const portalSlug = (params?.portal as string) || "atlanta";
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal;
  const inferredVertical = resolveSkeletonVertical(portal, portalSlug);

  if (inferredVertical === "hotel") {
    return <HotelPortalLoading portalName={portal?.name || "Hotel"} />;
  }

  if (inferredVertical === "hospital") {
    return <HospitalPortalLoading />;
  }

  if (inferredVertical === "film") {
    return <FilmPortalLoading />;
  }

  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="city" className="min-h-screen">
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

function HotelPortalLoading({ portalName }: { portalName: string }) {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="hotel" className="min-h-screen bg-[var(--hotel-ivory)] text-[var(--hotel-charcoal)]">
      <header className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-32 rounded" />
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--hotel-stone)] hidden sm:inline">Concierge</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-14 rounded" delay="0.04s" />
            <Skeleton className="h-3 w-14 rounded" delay="0.08s" />
            <Skeleton className="h-3 w-10 rounded" delay="0.12s" />
          </div>
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12 space-y-8">
        <section className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-6 md:p-8 shadow-[var(--hotel-shadow-soft)]">
          <div className="space-y-3 max-w-3xl">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-10 w-[70%] rounded" delay="0.04s" />
            <Skeleton className="h-4 w-full rounded" delay="0.08s" />
            <Skeleton className="h-4 w-[82%] rounded" delay="0.12s" />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" delay="0.04s" />
            <Skeleton className="h-8 w-32 rounded-full" delay="0.08s" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 h-64 rounded-2xl skeleton-shimmer" />
          <div className="h-64 rounded-2xl skeleton-shimmer" />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-7 w-56 rounded" />
            <Skeleton className="h-3 w-20 rounded" delay="0.05s" />
          </div>
          <div className="flex gap-3 overflow-hidden -mx-2 px-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[min(82vw,304px)] h-72 rounded-xl" delay={`${i * 0.06}s`} />
            ))}
          </div>
        </section>
      </main>
      <div className="sr-only">Loading {portalName} concierge</div>
    </div>
  );
}

function HospitalPortalLoading() {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="hospital" className="min-h-screen bg-[#f2f5fa] text-[#12326a]">
      <div className="border-b border-[#d5dfef] bg-white/90">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Skeleton className="h-6 w-44 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-12 rounded" delay="0.05s" />
            <Skeleton className="h-3 w-14 rounded" delay="0.1s" />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-[28px] border border-[#d5dfef] bg-white p-6 md:p-7">
          <Skeleton className="h-3 w-40 rounded" />
          <Skeleton className="h-10 w-[76%] rounded mt-3" delay="0.04s" />
          <Skeleton className="h-4 w-full rounded mt-3" delay="0.08s" />
          <Skeleton className="h-4 w-[84%] rounded mt-2" delay="0.12s" />
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" delay="0.05s" />
            <Skeleton className="h-10 rounded-xl" delay="0.1s" />
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#d5dfef] bg-white p-4">
              <Skeleton className="h-4 w-28 rounded" delay={`${i * 0.04}s`} />
              <Skeleton className="h-3 w-full rounded mt-2" delay={`${i * 0.04 + 0.05}s`} />
              <Skeleton className="h-3 w-[80%] rounded mt-1" delay={`${i * 0.04 + 0.1}s`} />
            </div>
          ))}
        </section>

        <Skeleton className="h-64 rounded-3xl" delay="0.2s" />
      </main>
    </div>
  );
}

function FilmPortalLoading() {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="film" className="min-h-screen bg-[#070a12] text-[#f3f4f6]">
      <div className="border-b border-[#1d2331] bg-[#070a12]/92">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Skeleton className="h-6 w-40 rounded" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-3 w-16 rounded" delay="0.05s" />
            <Skeleton className="h-3 w-12 rounded" delay="0.1s" />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-3xl border border-[#2a3244] p-6 sm:p-8">
          <Skeleton className="h-5 w-48 rounded-full" />
          <Skeleton className="h-12 w-[82%] rounded mt-4" delay="0.04s" />
          <Skeleton className="h-4 w-full rounded mt-4" delay="0.08s" />
          <Skeleton className="h-4 w-[86%] rounded mt-2" delay="0.12s" />
          <div className="mt-5 flex flex-wrap gap-2">
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-10 w-44 rounded-xl" delay="0.05s" />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" delay="0.04s" />
          <Skeleton className="h-24 rounded-2xl" delay="0.08s" />
        </section>

        <Skeleton className="h-72 rounded-2xl" delay="0.15s" />
      </main>
    </div>
  );
}
