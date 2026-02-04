export default function SpotsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-32 skeleton-shimmer rounded mb-2" />
        <div className="h-4 w-56 skeleton-shimmer rounded" style={{ animationDelay: "0.05s" }} />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="h-10 w-48 skeleton-shimmer rounded-lg" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 skeleton-shimmer rounded-lg"
            style={{
              width: `${70 + i * 12}px`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>

      {/* Spots grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--twilight)] overflow-hidden"
            style={{ backgroundColor: "var(--card-bg)" }}
          >
            {/* Image skeleton */}
            <div className="aspect-video skeleton-shimmer" style={{ animationDelay: `${i * 0.05}s` }} />

            {/* Content skeleton */}
            <div className="p-4 space-y-3">
              <div className="h-5 skeleton-shimmer rounded w-3/4" style={{ animationDelay: `${i * 0.05 + 0.05}s` }} />
              <div className="h-3 skeleton-shimmer rounded w-1/2" style={{ animationDelay: `${i * 0.05 + 0.1}s` }} />
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.05 + 0.15}s` }} />
                <div className="h-3 w-20 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.05 + 0.2}s` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
