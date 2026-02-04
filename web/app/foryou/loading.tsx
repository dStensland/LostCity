import { EventCardSkeletonList } from "@/components/EventCardSkeleton";

export default function ForYouLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-32 skeleton-shimmer rounded mb-2" />
        <div className="h-4 w-56 skeleton-shimmer rounded" style={{ animationDelay: "0.05s" }} />
      </div>

      {/* Filter row skeleton */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 rounded-lg skeleton-shimmer flex-shrink-0"
            style={{
              width: `${60 + i * 10}px`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>

      {/* Event cards skeleton */}
      <EventCardSkeletonList count={6} />
    </div>
  );
}
