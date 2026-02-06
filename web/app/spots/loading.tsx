import Skeleton from "@/components/Skeleton";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";

export default function SpotsLoading() {
  const filterWidths = [1, 2, 3].map((i) => 70 + i * 12);
  const filterWidthClasses = filterWidths.map((width) =>
    createCssVarClassForLength("--skeleton-width", `${width}px`, "spots-filter-width")
  );
  const filterWidthCss = filterWidthClasses
    .map((entry) => entry?.css)
    .filter(Boolean)
    .join("\n");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <ScopedStyles css={filterWidthCss} />
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-32 skeleton-shimmer rounded mb-2" />
        <Skeleton className="h-4 w-56 rounded" delay="0.05s" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="h-10 w-48 skeleton-shimmer rounded-lg" />
        {filterWidthClasses.map((widthClass, index) => (
          <Skeleton
            key={index}
            className={`h-10 rounded-lg w-[var(--skeleton-width)] ${widthClass?.className ?? ""}`}
            delay={`${(index + 1) * 0.05}s`}
          />
        ))}
      </div>

      {/* Spots grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg)]"
          >
            {/* Image skeleton */}
            <Skeleton className="aspect-video" delay={`${i * 0.05}s`} />

            {/* Content skeleton */}
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 rounded w-3/4" delay={`${i * 0.05 + 0.05}s`} />
              <Skeleton className="h-3 rounded w-1/2" delay={`${i * 0.05 + 0.1}s`} />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-16 rounded" delay={`${i * 0.05 + 0.15}s`} />
                <Skeleton className="h-3 w-20 rounded" delay={`${i * 0.05 + 0.2}s`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
