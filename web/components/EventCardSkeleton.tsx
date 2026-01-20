"use client";

export default function EventCardSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--twilight)] mb-2 animate-pulse"
      style={{ borderLeftWidth: "3px", borderLeftColor: "var(--twilight)", backgroundColor: "var(--card-bg)" }}
    >
      {/* Time placeholder */}
      <div className="flex-shrink-0 w-12 h-4 bg-[var(--twilight)]/50 rounded" />

      {/* Icon placeholder */}
      <div className="flex-shrink-0 w-4 h-4 bg-[var(--twilight)]/50 rounded" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Title row */}
        <div className="h-4 bg-[var(--twilight)]/50 rounded w-3/4" />

        {/* Details row */}
        <div className="flex gap-2">
          <div className="h-3 bg-[var(--twilight)]/30 rounded w-24" />
          <div className="h-3 bg-[var(--twilight)]/30 rounded w-16" />
          <div className="h-3 bg-[var(--twilight)]/30 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

export function EventCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
