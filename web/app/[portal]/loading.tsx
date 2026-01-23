"use client";

import UnifiedHeader from "@/components/UnifiedHeader";
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
            className="absolute inset-0 opacity-20"
            style={{
              background: "radial-gradient(ellipse at 50% 0%, var(--neon-magenta) 0%, transparent 70%)",
            }}
          />

          <div className="relative">
            {/* Section header skeleton */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full skeleton-shimmer" />
              <div>
                <div className="h-5 w-32 rounded skeleton-shimmer mb-1" />
                <div className="h-3 w-44 rounded skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
              </div>
            </div>

            {/* Hero card skeleton */}
            <div
              className="rounded-2xl overflow-hidden mb-4 relative"
              style={{ backgroundColor: "var(--dusk)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="relative p-5 pt-32">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                  <div className="h-5 w-14 rounded-full skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
                </div>
                <div className="h-6 w-3/4 rounded skeleton-shimmer mb-2" style={{ animationDelay: "0.1s" }} />
                <div className="flex items-center gap-2">
                  <div className="h-4 w-12 rounded skeleton-shimmer" style={{ animationDelay: "0.15s" }} />
                  <div className="h-4 w-24 rounded skeleton-shimmer" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>

            {/* Secondary cards skeleton */}
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-[var(--twilight)]"
                  style={{ backgroundColor: "var(--dusk)" }}
                >
                  <div className="h-3 w-10 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.05 + 0.25}s` }} />
                  <div className="h-4 w-full rounded skeleton-shimmer mb-1" style={{ animationDelay: `${i * 0.05 + 0.3}s` }} />
                  <div className="h-4 w-2/3 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.05 + 0.35}s` }} />
                  <div className="h-3 w-1/2 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.4}s` }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Now skeleton */}
        <section className="py-4 border-b border-[var(--twilight)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded skeleton-shimmer" />
            <div className="h-3 w-24 rounded skeleton-shimmer" style={{ animationDelay: "0.5s" }} />
            <div className="h-4 w-8 rounded skeleton-shimmer" style={{ animationDelay: "0.55s" }} />
          </div>

          <div className="flex gap-3 overflow-hidden -mx-4 px-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-72 p-3 rounded-lg border border-[var(--twilight)]"
                style={{ backgroundColor: "var(--dusk)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full skeleton-shimmer" style={{ animationDelay: `${i * 0.08 + 0.6}s` }} />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-full rounded skeleton-shimmer mb-1" style={{ animationDelay: `${i * 0.08 + 0.65}s` }} />
                    <div className="h-4 w-3/4 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.08 + 0.7}s` }} />
                    <div className="h-3 w-24 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.08 + 0.75}s` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feed sections skeleton */}
        <div className="py-6 space-y-10">
          {/* Hero banner skeleton */}
          <div className="rounded-2xl h-56 sm:h-64 skeleton-shimmer" style={{ animationDelay: "0.9s" }} />

          {/* Carousel section skeleton */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-36 rounded skeleton-shimmer" style={{ animationDelay: "1s" }} />
              <div className="h-6 w-16 rounded-full skeleton-shimmer" style={{ animationDelay: "1.05s" }} />
            </div>
            <div className="flex gap-3 overflow-hidden -mx-4 px-4">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex-shrink-0 w-72 rounded-xl h-52 skeleton-shimmer" style={{ animationDelay: `${j * 0.1 + 1.1}s` }} />
              ))}
            </div>
          </div>

          {/* Grid section skeleton */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-32 rounded skeleton-shimmer" style={{ animationDelay: "1.5s" }} />
              <div className="h-6 w-16 rounded-full skeleton-shimmer" style={{ animationDelay: "1.55s" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="rounded-xl h-52 skeleton-shimmer" style={{ animationDelay: `${j * 0.1 + 1.6}s` }} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
