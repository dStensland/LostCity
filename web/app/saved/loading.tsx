export default function SavedLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 skeleton-shimmer rounded" />
        <div className="h-8 w-8 skeleton-shimmer rounded-full" style={{ animationDelay: "0.05s" }} />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-10 skeleton-shimmer rounded-md" style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg"
          >
            <div className="flex gap-4">
              <div className="w-20 h-20 skeleton-shimmer rounded-lg" style={{ animationDelay: `${i * 0.05}s` }} />
              <div className="flex-1 space-y-2">
                <div className="h-5 skeleton-shimmer rounded w-3/4" style={{ animationDelay: `${i * 0.05 + 0.05}s` }} />
                <div className="h-4 skeleton-shimmer rounded w-1/2" style={{ animationDelay: `${i * 0.05 + 0.1}s` }} />
                <div className="h-3 skeleton-shimmer rounded w-1/3" style={{ animationDelay: `${i * 0.05 + 0.15}s` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
