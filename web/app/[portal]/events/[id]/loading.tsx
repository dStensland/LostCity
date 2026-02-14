"use client";

import UnifiedHeader from "@/components/UnifiedHeader";
import Skeleton from "@/components/Skeleton";
import { useParams } from "next/navigation";
import { usePortalOptional } from "@/lib/portal-context";
import { resolveSkeletonVertical } from "@/lib/skeleton-contract";

export default function EventLoading() {
  const params = useParams();
  const portalSlug = (params?.portal as string) || "atlanta";
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal;
  const vertical = resolveSkeletonVertical(portal, portalSlug);

  if (vertical === "hotel") {
    return (
      <div data-skeleton-route="event-detail" data-skeleton-vertical="hotel" className="min-h-screen bg-[var(--hotel-ivory)]">
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="h-[420px] rounded-2xl skeleton-shimmer mb-6" />
          <div className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-6 sm:p-8">
            <Skeleton className="h-4 w-24 rounded mb-4" />
            <Skeleton className="h-10 w-[72%] rounded mb-2" />
            <Skeleton className="h-5 w-52 rounded mt-3" delay="0.05s" />
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--hotel-sand)] p-3">
                  <Skeleton className="h-3 w-16 rounded mb-2" delay={`${i * 0.05}s`} />
                  <Skeleton className="h-5 w-20 rounded" delay={`${i * 0.05 + 0.05}s`} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (vertical === "hospital") {
    return (
      <div data-skeleton-route="event-detail" data-skeleton-vertical="hospital" className="min-h-screen bg-[#f2f5fa]">
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="h-72 rounded-2xl skeleton-shimmer mb-6" />
          <div className="rounded-2xl border border-[#d5dfef] bg-white p-6 sm:p-8">
            <Skeleton className="h-4 w-24 rounded mb-4" />
            <Skeleton className="h-10 w-[68%] rounded mb-3" />
            <Skeleton className="h-4 w-60 rounded" delay="0.05s" />
            <div className="mt-6 space-y-2">
              <Skeleton className="h-4 w-full rounded" delay="0.1s" />
              <Skeleton className="h-4 w-[86%] rounded" delay="0.15s" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (vertical === "film") {
    return (
      <div data-skeleton-route="event-detail" data-skeleton-vertical="film" className="min-h-screen bg-[#070a12]">
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="h-80 rounded-2xl skeleton-shimmer mb-6" />
          <div className="rounded-2xl border border-[#2a3244] bg-[#0c1321] p-6 sm:p-8">
            <Skeleton className="h-4 w-24 rounded mb-4" />
            <Skeleton className="h-10 w-[74%] rounded mb-3" />
            <Skeleton className="h-4 w-48 rounded" delay="0.05s" />
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" delay={`${i * 0.05}s`} />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div data-skeleton-route="event-detail" data-skeleton-vertical="city" className="min-h-screen">
      <UnifiedHeader portalSlug={portalSlug} />

      <main
        className="max-w-3xl mx-auto px-4 py-8 animate-fade-in"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        {/* Image skeleton */}
        <div className="aspect-video bg-[var(--twilight)]/30 rounded-lg mb-6 skeleton-shimmer" />

        {/* Main card skeleton */}
        <div className="border border-[var(--twilight)] rounded-lg p-6 sm:p-8 bg-[var(--card-bg)]">
          {/* Category badge */}
          <div className="flex gap-2 mb-4">
            <div className="h-5 w-16 rounded skeleton-shimmer" />
          </div>

          {/* Title */}
          <div className="h-8 w-3/4 rounded skeleton-shimmer mb-2" />
          <Skeleton className="h-8 w-1/2 rounded" delay="0.05s" />

          {/* Venue */}
          <Skeleton className="h-5 w-48 rounded mt-3" delay="0.1s" />

          {/* Date/Time/Price grid */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg p-3 sm:p-4 border border-[var(--twilight)] bg-[var(--void)]"
              >
                <Skeleton className="h-3 w-8 mx-auto rounded mb-2" delay={`${i * 0.05}s`} />
                <Skeleton className="h-6 w-12 mx-auto rounded" delay={`${i * 0.05 + 0.05}s`} />
                <Skeleton className="h-3 w-10 mx-auto rounded mt-1" delay={`${i * 0.05 + 0.1}s`} />
              </div>
            ))}
          </div>

          {/* Description skeleton */}
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <div className="h-3 w-12 rounded skeleton-shimmer mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded" delay="0.15s" />
              <Skeleton className="h-4 w-full rounded" delay="0.2s" />
              <Skeleton className="h-4 w-3/4 rounded" delay="0.25s" />
            </div>
          </div>

          {/* Location skeleton */}
          <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
            <div className="h-3 w-16 rounded skeleton-shimmer mb-3" />
            <Skeleton className="h-4 w-40 rounded mb-1" delay="0.3s" />
            <Skeleton className="h-4 w-56 rounded" delay="0.35s" />
          </div>

          {/* Action buttons skeleton */}
          <div className="mt-8 pt-6 border-t border-[var(--twilight)] flex gap-3">
            <div className="h-10 w-24 rounded skeleton-shimmer" />
            <Skeleton className="h-10 w-24 rounded" delay="0.05s" />
          </div>

          <div className="mt-4 flex gap-3">
            <Skeleton className="h-12 w-32 rounded-lg" delay="0.1s" />
            <Skeleton className="h-12 w-36 rounded-lg" delay="0.15s" />
          </div>
        </div>
      </main>
    </div>
  );
}
