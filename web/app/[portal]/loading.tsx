// Server-rendered loading skeleton — no "use client", no JS required.
// The shimmer animation is pure CSS (globals.css), so it runs at T=0.
// Vertical is detected from the portal slug (params prop) without any hooks.
// PortalHeader is "use client", so we inline a lightweight static header here.

import { inferSkeletonVerticalFromSlug } from "@/lib/skeleton-contract";

type Props = {
  // Next.js passes params to loading.tsx in App Router
  params?: { portal?: string };
};

// Inline shimmer div — replaces the Skeleton component for server rendering.
// The CSS classes are defined in globals.css and work without JS.
// The `delay` is passed as an inline style so it renders in the initial HTML.
function S({
  className = "",
  delay,
  light,
}: {
  className?: string;
  delay?: string;
  light?: boolean;
}) {
  return (
    <div
      className={`${light ? "skeleton-shimmer-light" : "skeleton-shimmer-enhanced"} ${className}`}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

export default function PortalLoading({ params }: Props) {
  const portalSlug = params?.portal ?? "atlanta";
  const vertical = inferSkeletonVerticalFromSlug(portalSlug);

  if (vertical === "hotel") {
    return <HotelPortalLoading />;
  }

  if (vertical === "hospital") {
    return <HospitalPortalLoading />;
  }

  if (vertical === "film") {
    return <FilmPortalLoading />;
  }

  // Default: city feed skeleton (covers city, adventure, family, and unknown portals)
  return <CityFeedPortalLoading />;
}

// --- Inline static header skeleton ------------------------------------------
// Replaces PortalHeader (which is "use client") with a visually-equivalent
// static placeholder that renders in the initial HTML at T=0.

function StaticHeaderSkeleton({ light }: { light?: boolean }) {
  if (light) {
    return (
      <header className="sticky top-0 z-50 bg-[#faf8f4]/95 border-b border-black/8 h-14 flex items-center px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <S light className="h-5 w-24 rounded" />
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-50 bg-[var(--void)]/95 border-b border-[var(--twilight)]/60 h-14 flex items-center px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <S className="h-5 w-24 rounded" />
      </div>
    </header>
  );
}

// --- City feed skeleton (default) -------------------------------------------

function CityFeedPortalLoading() {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="city" className="min-h-screen">
      <StaticHeaderSkeleton />

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
              <S className="h-3 w-20 rounded-full" />
            </div>
            <div className="space-y-2">
              <S className="h-10 w-48 sm:w-64 rounded" delay="0.05s" />
              <S className="h-6 w-32 sm:w-40 rounded" delay="0.1s" />
              <S className="h-4 w-56 sm:w-72 rounded mt-3" delay="0.15s" />
              {/* Quick links skeleton */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {[0, 1, 2, 3].map((i) => (
                  <S key={i} className="h-7 w-20 rounded-full" delay={`${i * 0.04 + 0.2}s`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CityBriefing skeleton — "TODAY IN ATLANTA" news card */}
        <div className="mt-4 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/75 p-3.5">
          {/* Section header row */}
          <div className="flex items-center gap-2 mb-3">
            <S className="h-2.5 w-3 rounded" delay="0.25s" />
            <S className="h-2.5 w-28 rounded" delay="0.27s" />
          </div>
          {/* 3 news item rows */}
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex gap-2.5 items-start ${i > 0 ? "mt-2.5" : ""}`}>
              <S className="w-10 h-10 rounded-md flex-shrink-0" delay={`${i * 0.05 + 0.3}s`} />
              <div className="flex-1 min-w-0 py-0.5">
                <S className="h-3.5 w-[75%] rounded mb-1.5" delay={`${i * 0.05 + 0.32}s`} />
                <S className="h-3 w-[50%] rounded" delay={`${i * 0.05 + 0.34}s`} />
              </div>
            </div>
          ))}
        </div>

        {/* Lineup section skeleton — event card rows */}
        <div className="mt-4" style={{ minHeight: 400 }}>
          {/* Tab bar skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <S className="h-4 w-3 rounded" delay="0.35s" />
            <S className="h-3 w-20 rounded" delay="0.35s" />
          </div>
          <div className="flex gap-2 mb-5">
            {[0, 1, 2].map((i) => (
              <S key={i} className="h-9 w-24 rounded-lg" delay={`${i * 0.04 + 0.4}s`} />
            ))}
          </div>

          {/* Event card skeletons */}
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--twilight)]/75 bg-[var(--night)] p-3 sm:p-3.5">
                <div className="flex gap-2.5 sm:gap-3">
                  {/* Date rail (desktop) */}
                  <div className="hidden sm:flex flex-col items-center w-[100px] -ml-3.5 -my-3.5 rounded-l-xl overflow-hidden">
                    <S className="w-full h-full" delay={`${i * 0.06 + 0.5}s`} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-2 mb-2 sm:hidden">
                      <S className="h-3 w-14 rounded" delay={`${i * 0.06 + 0.5}s`} />
                    </div>
                    <div className="flex items-start gap-2.5">
                      <S className="w-8 h-8 rounded-lg flex-shrink-0" delay={`${i * 0.06 + 0.52}s`} />
                      <div className="flex-1">
                        <S className="h-5 w-[70%] rounded mb-1.5" delay={`${i * 0.06 + 0.54}s`} />
                        <S className="h-4 w-[50%] rounded mb-1" delay={`${i * 0.06 + 0.56}s`} />
                        <S className="h-3 w-[40%] rounded" delay={`${i * 0.06 + 0.58}s`} />
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
              <S className="w-3.5 h-3.5 rounded" delay="0.9s" />
              <S className="h-3 w-28 rounded" delay="0.92s" />
              <div className="flex-1" />
              <S className="h-3 w-14 rounded" delay="0.94s" />
            </div>
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--twilight)]/75 bg-[var(--night)] p-3">
                  <div className="flex gap-3 items-center">
                    <S className="w-10 h-10 rounded-lg flex-shrink-0" delay={`${i * 0.05 + 1}s`} />
                    <div className="flex-1">
                      <S className="h-4 w-[60%] rounded mb-1" delay={`${i * 0.05 + 1.02}s`} />
                      <S className="h-3 w-[40%] rounded" delay={`${i * 0.05 + 1.04}s`} />
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

// --- Hotel portal skeleton ---------------------------------------------------

function HotelPortalLoading() {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="hotel" className="min-h-screen bg-[var(--hotel-ivory)] text-[var(--hotel-charcoal)]">
      <header className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <S light className="h-8 w-32 rounded" />
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--hotel-stone)] hidden sm:inline">Concierge</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <S light className="h-3 w-12 rounded" />
            <S light className="h-3 w-14 rounded" delay="0.04s" />
            <S light className="h-3 w-14 rounded" delay="0.08s" />
            <S light className="h-3 w-10 rounded" delay="0.12s" />
          </div>
          <S light className="h-5 w-5 rounded-full" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12 space-y-8">
        <section className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-6 md:p-8 shadow-[var(--hotel-shadow-soft)]">
          <div className="space-y-3 max-w-3xl">
            <S light className="h-3 w-28 rounded" />
            <S light className="h-10 w-[70%] rounded" delay="0.04s" />
            <S light className="h-4 w-full rounded" delay="0.08s" />
            <S light className="h-4 w-[82%] rounded" delay="0.12s" />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <S light className="h-8 w-28 rounded-full" />
            <S light className="h-8 w-24 rounded-full" delay="0.04s" />
            <S light className="h-8 w-32 rounded-full" delay="0.08s" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 h-64 rounded-2xl skeleton-shimmer-light" />
          <div className="h-64 rounded-2xl skeleton-shimmer-light" />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <S light className="h-7 w-56 rounded" />
            <S light className="h-3 w-20 rounded" delay="0.05s" />
          </div>
          <div className="flex gap-3 overflow-hidden -mx-2 px-2">
            {[0, 1, 2, 3].map((i) => (
              <S light key={i} className="flex-shrink-0 w-[min(82vw,304px)] h-72 rounded-xl" delay={`${i * 0.06}s`} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// --- Hospital portal skeleton ------------------------------------------------

function HospitalPortalLoading() {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="hospital" className="min-h-screen bg-[#f2f5fa] text-[#12326a]">
      <div className="border-b border-[#d5dfef] bg-white/90">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <S light className="h-6 w-44 rounded" />
          <div className="flex items-center gap-3">
            <S light className="h-3 w-16 rounded" />
            <S light className="h-3 w-12 rounded" delay="0.05s" />
            <S light className="h-3 w-14 rounded" delay="0.1s" />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-[28px] border border-[#d5dfef] bg-white p-6 md:p-7">
          <S light className="h-3 w-40 rounded" />
          <S light className="h-10 w-[76%] rounded mt-3" delay="0.04s" />
          <S light className="h-4 w-full rounded mt-3" delay="0.08s" />
          <S light className="h-4 w-[84%] rounded mt-2" delay="0.12s" />
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <S light className="h-10 rounded-xl" />
            <S light className="h-10 rounded-xl" delay="0.05s" />
            <S light className="h-10 rounded-xl" delay="0.1s" />
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#d5dfef] bg-white p-4">
              <S light className="h-4 w-28 rounded" delay={`${i * 0.04}s`} />
              <S light className="h-3 w-full rounded mt-2" delay={`${i * 0.04 + 0.05}s`} />
              <S light className="h-3 w-[80%] rounded mt-1" delay={`${i * 0.04 + 0.1}s`} />
            </div>
          ))}
        </section>

        <S light className="h-64 rounded-3xl" delay="0.2s" />
      </main>
    </div>
  );
}

// --- Film portal skeleton ----------------------------------------------------

function FilmPortalLoading() {
  return (
    <div data-skeleton-route="portal-root" data-skeleton-vertical="film" className="min-h-screen bg-[#070a12] text-[#f3f4f6]">
      <div className="border-b border-[#1d2331] bg-[#070a12]/92">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <S className="h-6 w-40 rounded" />
          <div className="flex items-center gap-4">
            <S className="h-3 w-14 rounded" />
            <S className="h-3 w-16 rounded" delay="0.05s" />
            <S className="h-3 w-12 rounded" delay="0.1s" />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-3xl border border-[#2a3244] p-6 sm:p-8">
          <S className="h-5 w-48 rounded-full" />
          <S className="h-12 w-[82%] rounded mt-4" delay="0.04s" />
          <S className="h-4 w-full rounded mt-4" delay="0.08s" />
          <S className="h-4 w-[86%] rounded mt-2" delay="0.12s" />
          <div className="mt-5 flex flex-wrap gap-2">
            <S className="h-10 w-40 rounded-xl" />
            <S className="h-10 w-44 rounded-xl" delay="0.05s" />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <S className="h-24 rounded-2xl" />
          <S className="h-24 rounded-2xl" delay="0.04s" />
          <S className="h-24 rounded-2xl" delay="0.08s" />
        </section>

        <S className="h-72 rounded-2xl" delay="0.15s" />
      </main>
    </div>
  );
}
