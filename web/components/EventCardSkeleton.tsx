"use client";

interface EventCardSkeletonProps {
  /** Show thumbnail skeleton on mobile (matches EventCard showThumbnail prop) */
  showThumbnail?: boolean;
}

// Skeleton must match EventCard exactly: p-3, flex gap-3, same structure
export default function EventCardSkeleton({ showThumbnail = false }: EventCardSkeletonProps) {
  return (
    <div
      className="block p-3 mb-4 rounded-lg border border-[var(--twilight)]"
      style={{ borderLeftWidth: "3px", borderLeftColor: "var(--twilight)", backgroundColor: "var(--card-bg)" }}
    >
      <div className="flex gap-3">
        {/* Time cell - matches EventCard: w-12, flex-col, center */}
        <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center">
          <div className="h-4 w-8 rounded skeleton-shimmer" />
          <div className="h-2 w-5 rounded mt-1 skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
        </div>

        {/* Mobile thumbnail skeleton - hidden on sm+ */}
        {showThumbnail && (
          <div className="flex-shrink-0 w-16 h-16 rounded-lg skeleton-shimmer sm:hidden" style={{ animationDelay: "0.05s" }} />
        )}

        {/* Content - matches EventCard structure */}
        <div className="flex-1 min-w-0">
          {/* Title row with category icon container */}
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded skeleton-shimmer" />
            <div className="h-4 rounded w-3/4 skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
          </div>

          {/* Details row */}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="h-3 rounded w-24 skeleton-shimmer" style={{ animationDelay: "0.15s" }} />
            <div className="h-3 rounded w-16 skeleton-shimmer" style={{ animationDelay: "0.2s" }} />
            <div className="h-3 rounded w-12 skeleton-shimmer" style={{ animationDelay: "0.25s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface EventCardSkeletonListProps {
  count?: number;
  showThumbnail?: boolean;
}

export function EventCardSkeletonList({ count = 5, showThumbnail = false }: EventCardSkeletonListProps) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} showThumbnail={showThumbnail} />
      ))}
    </div>
  );
}
