import { EventCardSkeletonList } from "@/components/EventCardSkeleton";
import Skeleton from "@/components/Skeleton";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";

/**
 * Loading skeleton for happening-now pages.
 * Uses Next.js 13+ streaming with Suspense for better perceived performance.
 */
export default function HappeningNowLoading() {
  const filterWidths = [1, 2, 3, 4].map((i) => 50 + i * 12);
  const filterWidthClasses = filterWidths.map((width) =>
    createCssVarClassForLength("--skeleton-width", `${width}px`, "hn-filter-width")
  );
  const filterWidthCss = filterWidthClasses
    .map((entry) => entry?.css)
    .filter(Boolean)
    .join("\n");

  return (
    <div className="min-h-screen bg-[var(--void)]">
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
