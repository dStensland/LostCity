"use client";

import Skeleton from "@/components/Skeleton";

// Skeleton must match EventCard exactly: container + content + CTA row
export default function EventCardSkeleton() {
  return (
    <div
      className="mb-4 rounded-sm border border-[var(--twilight)] border-l-[3px] border-l-[var(--twilight)] bg-[var(--card-bg)]"
    >
      <div className="flex gap-3">
        <div className="p-3 flex-1 min-w-0">
          <div className="flex gap-3">
            {/* Time cell - matches EventCard: w-14, flex-col, center */}
            <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center">
              <div className="h-4 w-8 rounded skeleton-shimmer" />
              <Skeleton className="h-2 w-5 rounded mt-1" delay="0.1s" />
            </div>

            {/* Content - matches EventCard structure */}
            <div className="flex-1 min-w-0">
              {/* Title row with category icon container */}
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded skeleton-shimmer" />
                <Skeleton className="h-4 rounded w-3/4" delay="0.05s" />
              </div>

              {/* Details row */}
              <div className="flex items-center gap-1.5 mt-2">
                <Skeleton className="h-3 rounded w-24" delay="0.15s" />
                <Skeleton className="h-3 rounded w-16" delay="0.2s" />
                <Skeleton className="h-3 rounded w-12" delay="0.25s" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pt-3 pr-3 pb-3 flex-shrink-0">
          <Skeleton className="h-11 w-11 rounded-xl" delay="0.2s" />
          <Skeleton className="h-11 w-11 rounded-xl" delay="0.3s" />
        </div>
      </div>
    </div>
  );
}

interface EventCardSkeletonListProps {
  count?: number;
}

export function EventCardSkeletonList({ count = 5 }: EventCardSkeletonListProps) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
