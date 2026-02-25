"use client";

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

      {/* Sticky filter bar skeleton */}
      <div className="sticky top-[52px] z-20 bg-[var(--night)]/95 border-b border-[var(--twilight)]/50">
        <div className="max-w-3xl mx-auto px-4 py-2 space-y-2">
          {/* Row 1: dropdown + icon buttons + count badge */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-[200px] rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" delay="0.05s" />
            <Skeleton className="h-8 w-8 rounded-lg" delay="0.1s" />
            <Skeleton className="h-8 w-20 rounded-lg ml-auto" delay="0.15s" />
          </div>
          {/* Row 2: category chips */}
          <div className="flex gap-2 overflow-hidden">
            {filterWidthClasses.map((widthClass, index) => (
              <Skeleton
                key={index}
                className={`h-8 rounded-lg flex-shrink-0 w-[var(--skeleton-width)] ${widthClass?.className ?? ""}`}
                delay={`${(index + 1) * 0.05}s`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content skeletons */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Summary header skeleton */}
        <div className="mb-4">
          <Skeleton className="h-6 w-32 rounded mb-2" />
          <Skeleton className="h-4 w-56 rounded mb-3" delay="0.05s" />
          <div className="flex gap-3">
            <div className="flex-1 h-16 rounded-xl skeleton-shimmer" />
            <div className="flex-1 h-16 rounded-xl skeleton-shimmer" style={{ animationDelay: "60ms" }} />
          </div>
        </div>

        <div className="border-t border-[var(--twilight)]/40 mb-2" />

        {/* Collapsed cluster header skeletons */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 rounded" delay={`${i * 0.06}s`} />
              <Skeleton className="h-3.5 w-14 rounded" delay={`${i * 0.06 + 0.03}s`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
