import { EventCardSkeletonList } from "@/components/EventCardSkeleton";
import Skeleton from "@/components/Skeleton";

export default function ForYouLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-32 skeleton-shimmer rounded mb-2" />
        <Skeleton className="h-4 w-56 rounded" delay="0.05s" />
      </div>

      {/* Filter row skeleton */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {(["w-16", "w-20", "w-24", "w-28"] as const).map((widthClass, i) => (
          <Skeleton
            key={widthClass}
            className={`h-8 rounded-lg flex-shrink-0 ${widthClass}`}
            delay={`${(i + 1) * 0.05}s`}
          />
        ))}
      </div>

      {/* Event cards skeleton */}
      <EventCardSkeletonList count={6} />
    </div>
  );
}
