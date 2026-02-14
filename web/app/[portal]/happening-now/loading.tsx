"use client";

import { EventCardSkeletonList } from "@/components/EventCardSkeleton";
import Skeleton from "@/components/Skeleton";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";
import { useParams } from "next/navigation";
import { usePortalOptional } from "@/lib/portal-context";
import { resolveSkeletonVertical } from "@/lib/skeleton-contract";

/**
 * Loading skeleton for portal happening-now pages.
 * Uses Next.js 13+ streaming with Suspense for better perceived performance.
 */
export default function PortalHappeningNowLoading() {
  const params = useParams();
  const portalSlug = (params?.portal as string) || "atlanta";
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal;
  const vertical = resolveSkeletonVertical(portal, portalSlug);

  if (vertical === "hotel") {
    return (
      <div data-skeleton-route="happening-now" data-skeleton-vertical="hotel" className="min-h-screen bg-[var(--hotel-ivory)]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-56 rounded mb-3" />
          <Skeleton className="h-4 w-72 rounded mb-6" delay="0.05s" />
          <div className="h-56 rounded-2xl skeleton-shimmer mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (vertical === "hospital") {
    return (
      <div data-skeleton-route="happening-now" data-skeleton-vertical="hospital" className="min-h-screen bg-[#f2f5fa]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-56 rounded mb-3" />
          <Skeleton className="h-4 w-72 rounded mb-6" delay="0.05s" />
          <div className="h-56 rounded-2xl skeleton-shimmer mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (vertical === "film") {
    return (
      <div data-skeleton-route="happening-now" data-skeleton-vertical="film" className="min-h-screen bg-[#070a12]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-56 rounded mb-3" />
          <Skeleton className="h-4 w-72 rounded mb-6" delay="0.05s" />
          <div className="h-56 rounded-2xl skeleton-shimmer mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filterWidths = [1, 2, 3, 4].map((i) => 50 + i * 12);
  const filterWidthClasses = filterWidths.map((width) =>
    createCssVarClassForLength("--skeleton-width", `${width}px`, "portal-hn-filter-width")
  );
  const filterWidthCss = filterWidthClasses
    .map((entry) => entry?.css)
    .filter(Boolean)
    .join("\n");

  return (
    <div data-skeleton-route="happening-now" data-skeleton-vertical="city" className="min-h-screen bg-[var(--void)]">
      <ScopedStyles css={filterWidthCss} />
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[var(--neon-red)] animate-pulse" />
            <div className="h-6 w-36 rounded skeleton-shimmer" />
          </div>
          <Skeleton className="h-4 w-48 rounded" delay="0.1s" />
        </div>

        {/* Map placeholder skeleton */}
        <div className="h-48 md:h-64 rounded-lg skeleton-shimmer mb-6" />

        {/* Filter row skeleton */}
        <div className="flex gap-2 mb-4 overflow-hidden">
          {filterWidthClasses.map((widthClass, index) => (
            <Skeleton
              key={index}
              className={`h-8 rounded-lg flex-shrink-0 w-[var(--skeleton-width)] ${widthClass?.className ?? ""}`}
              delay={`${(index + 1) * 0.05}s`}
            />
          ))}
        </div>

        {/* Event cards skeleton */}
        <EventCardSkeletonList count={5} />
      </div>
    </div>
  );
}
