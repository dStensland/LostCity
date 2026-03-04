"use client";

import { PortalHeader } from "@/components/headers";
import Skeleton from "@/components/Skeleton";
import { useParams, useSearchParams } from "next/navigation";
import { usePortalOptional } from "@/lib/portal-context";
import { resolveSkeletonVertical } from "@/lib/skeleton-contract";

export default function PortalLoading() {
  const params = useParams();
  const searchParams = useSearchParams();
  const portalSlug = (params?.portal as string) || "atlanta";
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal;
  const inferredVertical = resolveSkeletonVertical(portal, portalSlug);
  const viewParam = searchParams?.get("view");
  const hasFindSignals = Boolean(
    searchParams?.get("type") ||
      searchParams?.get("display") ||
      searchParams?.get("search") ||
      searchParams?.get("categories") ||
      searchParams?.get("subcategories") ||
      searchParams?.get("genres") ||
      searchParams?.get("tags") ||
      searchParams?.get("vibes") ||
      searchParams?.get("neighborhoods") ||
      searchParams?.get("price") ||
      searchParams?.get("free") ||
      searchParams?.get("date") ||
      searchParams?.get("mood")
  );
  const viewMode: "feed" | "find" | "community" =
    viewParam === "community"
      ? "community"
      : viewParam === "find" ||
          viewParam === "events" ||
          viewParam === "spots" ||
          viewParam === "map" ||
          viewParam === "calendar" ||
          hasFindSignals
        ? "find"
        : "feed";

  if (inferredVertical === "hotel") {
    return <HotelPortalLoading portalName={portal?.name || "Hotel"} />;
  }

  if (inferredVertical === "hospital") {
    return <HospitalPortalLoading />;
  }

  if (inferredVertical === "film") {
    return <FilmPortalLoading />;
  }

  if (viewMode === "find") {
    return <CityFindPortalLoading portalSlug={portalSlug} portalName={portal?.name || "Lost City"} />;
  }

  if (viewMode === "community") {
    return <CityCommunityPortalLoading portalSlug={portalSlug} portalName={portal?.name || "Lost City"} />;
  }

  return <CityFeedPortalLoading portalSlug={portalSlug} portalName={portal?.name || "Lost City"} />;
}

function CityFeedPortalLoading({ portalSlug, portalName }: { portalSlug: string; portalName: string }) {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="city" className="min-h-screen">
      <PortalHeader portalSlug={portalSlug} portalName={portalName} />

      <main className="max-w-3xl mx-auto px-4 pb-16">
        {/* GreetingBar hero skeleton — matches the full-bleed photo hero */}
        <div
          className="relative overflow-hidden -mx-4"
          style={{ minHeight: 300 }}
        >
          {/* Dark base + subtle gradient overlay matching real hero */}
          <div className="absolute inset-0 bg-[var(--night)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--night)]/50 via-transparent to-[var(--void)]" />

          {/* Masthead text skeleton */}
          <div className="relative z-10 flex flex-col justify-end min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-5">
            <div className="mb-auto pt-2">
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-10 w-48 sm:w-64 rounded" delay="0.05s" />
              <Skeleton className="h-6 w-32 sm:w-40 rounded" delay="0.1s" />
              <Skeleton className="h-4 w-56 sm:w-72 rounded mt-3" delay="0.15s" />
              {/* Quick links skeleton */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-full" delay={`${i * 0.04 + 0.2}s`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lineup section skeleton — event card rows */}
        <div className="mt-4" style={{ minHeight: 400 }}>
          {/* Tab bar skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-3 rounded" delay="0.35s" />
            <Skeleton className="h-3 w-20 rounded" delay="0.35s" />
          </div>
          <div className="flex gap-2 mb-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-lg" delay={`${i * 0.04 + 0.4}s`} />
            ))}
          </div>

          {/* Event card skeletons */}
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--twilight)]/75 bg-[var(--night)] p-3 sm:p-3.5">
                <div className="flex gap-2.5 sm:gap-3">
                  {/* Date rail (desktop) */}
                  <div className="hidden sm:flex flex-col items-center w-[100px] -ml-3.5 -my-3.5 rounded-l-xl overflow-hidden">
                    <Skeleton className="w-full h-full" delay={`${i * 0.06 + 0.5}s`} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-2 mb-2 sm:hidden">
                      <Skeleton className="h-3 w-14 rounded" delay={`${i * 0.06 + 0.5}s`} />
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" delay={`${i * 0.06 + 0.52}s`} />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-[70%] rounded mb-1.5" delay={`${i * 0.06 + 0.54}s`} />
                        <Skeleton className="h-4 w-[50%] rounded mb-1" delay={`${i * 0.06 + 0.56}s`} />
                        <Skeleton className="h-3 w-[40%] rounded" delay={`${i * 0.06 + 0.58}s`} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Below-fold section divider + placeholder */}
        <div className="mt-8">
          <div className="h-px bg-[var(--twilight)]" />
          <div className="pt-6" style={{ minHeight: 300 }}>
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="w-3.5 h-3.5 rounded" delay="0.9s" />
              <Skeleton className="h-3 w-28 rounded" delay="0.92s" />
              <div className="flex-1" />
              <Skeleton className="h-3 w-14 rounded" delay="0.94s" />
            </div>
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--twilight)]/75 bg-[var(--night)] p-3">
                  <div className="flex gap-3 items-center">
                    <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" delay={`${i * 0.05 + 1}s`} />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-[60%] rounded mb-1" delay={`${i * 0.05 + 1.02}s`} />
                      <Skeleton className="h-3 w-[40%] rounded" delay={`${i * 0.05 + 1.04}s`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function CityFindPortalLoading({ portalSlug, portalName }: { portalSlug: string; portalName: string }) {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="city" className="min-h-screen">
      <PortalHeader portalSlug={portalSlug} portalName={portalName} />
      <main className="max-w-5xl mx-auto px-4 pb-20">
        <div className="py-3 space-y-3">
          <section className="rounded-2xl border border-[var(--twilight)]/80 bg-gradient-to-b from-[var(--night)]/94 to-[var(--void)]/86 shadow-[0_14px_30px_rgba(0,0,0,0.24)] p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-lg" delay={`${i * 0.05}s`} />
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded-xl mb-3" />
            <div className="flex gap-2 mb-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-full" delay={`${i * 0.05 + 0.2}s`} />
              ))}
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </section>

          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-[var(--twilight)]/70 bg-[var(--dusk)]/75 p-4">
                <Skeleton className="h-4 w-20 rounded mb-2" delay={`${i * 0.05 + 0.35}s`} />
                <Skeleton className="h-6 w-[70%] rounded mb-2" delay={`${i * 0.05 + 0.4}s`} />
                <Skeleton className="h-4 w-[55%] rounded" delay={`${i * 0.05 + 0.45}s`} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function CityCommunityPortalLoading({ portalSlug, portalName }: { portalSlug: string; portalName: string }) {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="city" className="min-h-screen">
      <PortalHeader portalSlug={portalSlug} portalName={portalName} />
      <main className="max-w-5xl mx-auto px-4 pb-20">
        <div className="py-4 space-y-4">
          <div className="flex gap-2 p-1 rounded-xl border border-[var(--twilight)]/70 bg-[var(--void)]/70">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 flex-1 rounded-lg" delay={`${i * 0.05}s`} />
            ))}
          </div>

          <section className="rounded-2xl border border-[var(--twilight)]/70 bg-[var(--night)]/75 p-6">
            <div className="flex flex-col items-center text-center">
              <Skeleton className="h-14 w-14 rounded-2xl mb-4" />
              <Skeleton className="h-8 w-64 rounded mb-3" />
              <Skeleton className="h-4 w-[80%] max-w-lg rounded mb-1" delay="0.05s" />
              <Skeleton className="h-4 w-[68%] max-w-md rounded mb-5" delay="0.1s" />
              <Skeleton className="h-11 w-52 rounded-xl" delay="0.15s" />
            </div>
          </section>

          <div className="space-y-2.5 opacity-70">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--twilight)]/50 bg-[var(--dusk)]/70 p-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" delay={`${i * 0.05 + 0.2}s`} />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/2 rounded mb-2" delay={`${i * 0.05 + 0.25}s`} />
                    <Skeleton className="h-3 w-3/4 rounded" delay={`${i * 0.05 + 0.3}s`} />
                  </div>
                </div>
              </div>
            ))}
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
            <Skeleton light className="h-8 w-32 rounded" />
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--hotel-stone)] hidden sm:inline">Concierge</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <Skeleton light className="h-3 w-12 rounded" />
            <Skeleton light className="h-3 w-14 rounded" delay="0.04s" />
            <Skeleton light className="h-3 w-14 rounded" delay="0.08s" />
            <Skeleton light className="h-3 w-10 rounded" delay="0.12s" />
          </div>
          <Skeleton light className="h-5 w-5 rounded-full" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12 space-y-8">
        <section className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-6 md:p-8 shadow-[var(--hotel-shadow-soft)]">
          <div className="space-y-3 max-w-3xl">
            <Skeleton light className="h-3 w-28 rounded" />
            <Skeleton light className="h-10 w-[70%] rounded" delay="0.04s" />
            <Skeleton light className="h-4 w-full rounded" delay="0.08s" />
            <Skeleton light className="h-4 w-[82%] rounded" delay="0.12s" />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Skeleton light className="h-8 w-28 rounded-full" />
            <Skeleton light className="h-8 w-24 rounded-full" delay="0.04s" />
            <Skeleton light className="h-8 w-32 rounded-full" delay="0.08s" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 h-64 rounded-2xl skeleton-shimmer-light" />
          <div className="h-64 rounded-2xl skeleton-shimmer-light" />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <Skeleton light className="h-7 w-56 rounded" />
            <Skeleton light className="h-3 w-20 rounded" delay="0.05s" />
          </div>
          <div className="flex gap-3 overflow-hidden -mx-2 px-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton light key={i} className="flex-shrink-0 w-[min(82vw,304px)] h-72 rounded-xl" delay={`${i * 0.06}s`} />
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
          <Skeleton light className="h-6 w-44 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton light className="h-3 w-16 rounded" />
            <Skeleton light className="h-3 w-12 rounded" delay="0.05s" />
            <Skeleton light className="h-3 w-14 rounded" delay="0.1s" />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-[28px] border border-[#d5dfef] bg-white p-6 md:p-7">
          <Skeleton light className="h-3 w-40 rounded" />
          <Skeleton light className="h-10 w-[76%] rounded mt-3" delay="0.04s" />
          <Skeleton light className="h-4 w-full rounded mt-3" delay="0.08s" />
          <Skeleton light className="h-4 w-[84%] rounded mt-2" delay="0.12s" />
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Skeleton light className="h-10 rounded-xl" />
            <Skeleton light className="h-10 rounded-xl" delay="0.05s" />
            <Skeleton light className="h-10 rounded-xl" delay="0.1s" />
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#d5dfef] bg-white p-4">
              <Skeleton light className="h-4 w-28 rounded" delay={`${i * 0.04}s`} />
              <Skeleton light className="h-3 w-full rounded mt-2" delay={`${i * 0.04 + 0.05}s`} />
              <Skeleton light className="h-3 w-[80%] rounded mt-1" delay={`${i * 0.04 + 0.1}s`} />
            </div>
          ))}
        </section>

        <Skeleton light className="h-64 rounded-3xl" delay="0.2s" />
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
