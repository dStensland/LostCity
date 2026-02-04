export default function HomeLoading() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero Section skeleton */}
      <div className="flex flex-col items-center justify-center p-4 pt-24 pb-16 relative">
        {/* Logo skeleton */}
        <div className="h-16 w-48 skeleton-shimmer rounded mb-4" />
        <div className="h-6 w-64 skeleton-shimmer rounded mb-8" style={{ animationDelay: "0.1s" }} />
        <div className="h-14 w-56 skeleton-shimmer rounded" style={{ animationDelay: "0.2s" }} />
      </div>

      {/* Stats Row skeleton */}
      <div className="px-4 py-8">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="text-center p-4 rounded-none border-l-2 border-y border-r border-[var(--twilight)]"
              style={{
                backgroundColor: "var(--card-bg)",
                borderLeftColor: i === 0 ? "var(--coral)" : i === 1 ? "var(--neon-cyan)" : "var(--neon-amber)",
              }}
            >
              <div className="h-8 w-16 mx-auto skeleton-shimmer rounded mb-2" style={{ animationDelay: `${i * 0.05}s` }} />
              <div className="h-3 w-24 mx-auto skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.05 + 0.05}s` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Value Props skeleton */}
      <div className="px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="h-4 w-32 mx-auto skeleton-shimmer rounded mb-6" />
          <div className="grid sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="p-5 rounded-none border-t-2 border border-[var(--twilight)]"
                style={{
                  borderTopColor: i === 0 ? "var(--neon-magenta)" : i === 1 ? "var(--neon-cyan)" : "var(--neon-green)",
                }}
              >
                <div className="w-10 h-10 skeleton-shimmer rounded-none mb-3" style={{ animationDelay: `${i * 0.1}s` }} />
                <div className="h-5 w-3/4 skeleton-shimmer rounded mb-2" style={{ animationDelay: `${i * 0.1 + 0.05}s` }} />
                <div className="space-y-1">
                  <div className="h-3 w-full skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
                  <div className="h-3 w-5/6 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.1 + 0.15}s` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Preview skeleton */}
      <div className="px-4 py-8 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="h-4 w-40 mx-auto skeleton-shimmer rounded mb-6" style={{ animationDelay: "0.5s" }} />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-4 rounded-none border border-[var(--twilight)]"
                style={{ backgroundColor: "var(--card-bg)" }}
              >
                <div className="w-7 h-7 skeleton-shimmer rounded-full mb-2" style={{ animationDelay: `${i * 0.05 + 0.6}s` }} />
                <div className="h-2 w-12 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.05 + 0.65}s` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
