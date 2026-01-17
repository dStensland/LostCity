export default function EventCardSkeleton() {
  return (
    <div className="card-interactive rounded-xl p-4 animate-pulse">
      <div className="flex gap-4">
        {/* Time Column Skeleton */}
        <div className="flex-shrink-0 w-16 text-center pt-1">
          <div className="h-6 w-12 mx-auto bg-[var(--twilight)] rounded" />
          <div className="h-3 w-8 mx-auto mt-1 bg-[var(--twilight)] rounded" />
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 min-w-0">
          {/* Badge placeholder */}
          <div className="flex gap-1.5 mb-2">
            <div className="h-4 w-14 bg-[var(--twilight)] rounded" />
          </div>

          {/* Title placeholder - two lines */}
          <div className="space-y-2 mb-3">
            <div className="h-5 w-full bg-[var(--twilight)] rounded" />
            <div className="h-5 w-3/4 bg-[var(--twilight)] rounded" />
          </div>

          {/* Venue placeholder */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-3.5 h-3.5 bg-[var(--twilight)] rounded" />
            <div className="h-4 w-32 bg-[var(--twilight)] rounded" />
            <div className="h-4 w-20 bg-[var(--twilight)] rounded opacity-50" />
          </div>

          {/* Price & Actions placeholder */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 bg-[var(--twilight)] rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[var(--twilight)] rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
