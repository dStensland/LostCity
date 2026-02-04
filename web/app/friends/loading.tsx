export default function FriendsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-32 skeleton-shimmer rounded mb-2" />
        <div className="h-4 w-48 skeleton-shimmer rounded" style={{ animationDelay: "0.05s" }} />
      </div>

      {/* Search bar skeleton */}
      <div className="h-12 w-full skeleton-shimmer rounded-lg mb-6" style={{ animationDelay: "0.1s" }} />

      {/* Tabs skeleton */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-10 skeleton-shimmer rounded-md" style={{ animationDelay: `${i * 0.05 + 0.15}s` }} />
        ))}
      </div>

      {/* Friend list skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg"
          >
            <div className="w-12 h-12 rounded-full skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.3}s` }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton-shimmer rounded w-32" style={{ animationDelay: `${i * 0.05 + 0.35}s` }} />
              <div className="h-3 skeleton-shimmer rounded w-24" style={{ animationDelay: `${i * 0.05 + 0.4}s` }} />
            </div>
            <div className="h-8 w-20 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.05 + 0.45}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
