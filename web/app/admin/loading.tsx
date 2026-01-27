export default function AdminLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Title skeleton */}
      <div className="h-8 w-48 bg-[var(--twilight)] rounded skeleton-shimmer mb-8" />

      {/* Quick links skeleton */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 w-32 bg-[var(--twilight)] rounded skeleton-shimmer"
          />
        ))}
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg"
          >
            <div className="h-9 w-16 bg-[var(--twilight)] rounded skeleton-shimmer mb-2" />
            <div className="h-3 w-20 bg-[var(--twilight)] rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Recent users skeleton */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
        <div className="p-4 border-b border-[var(--twilight)] flex items-center justify-between">
          <div className="h-4 w-32 bg-[var(--twilight)] rounded skeleton-shimmer" />
          <div className="h-3 w-16 bg-[var(--twilight)] rounded skeleton-shimmer" />
        </div>
        <div className="divide-y divide-[var(--twilight)]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="w-8 h-8 rounded-full bg-[var(--twilight)] skeleton-shimmer" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-[var(--twilight)] rounded skeleton-shimmer mb-1" />
                <div className="h-3 w-20 bg-[var(--twilight)] rounded skeleton-shimmer" />
              </div>
              <div className="h-3 w-20 bg-[var(--twilight)] rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
