export default function CollectionsLoading() {
  return (
    <div className="min-h-screen">
      {/* Header placeholder - UnifiedHeader renders on its own */}
      <div className="h-16" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-32 skeleton-shimmer rounded" />
          <div className="h-10 w-36 skeleton-shimmer rounded-lg" style={{ animationDelay: "0.05s" }} />
        </div>

        {/* Featured section skeleton */}
        <section className="mb-10">
          <div className="h-4 w-24 skeleton-shimmer rounded mb-4" style={{ animationDelay: "0.1s" }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--twilight)] overflow-hidden"
                style={{ backgroundColor: "var(--card-bg)" }}
              >
                {/* Cover image skeleton */}
                <div className="aspect-[2/1] skeleton-shimmer" style={{ animationDelay: `${i * 0.1 + 0.15}s` }} />

                {/* Content skeleton */}
                <div className="p-6 space-y-3">
                  <div className="h-4 w-20 skeleton-shimmer rounded mb-2" style={{ animationDelay: `${i * 0.1 + 0.2}s` }} />
                  <div className="h-6 skeleton-shimmer rounded w-3/4" style={{ animationDelay: `${i * 0.1 + 0.25}s` }} />
                  <div className="h-3 skeleton-shimmer rounded w-full" style={{ animationDelay: `${i * 0.1 + 0.3}s` }} />
                  <div className="flex items-center gap-3 mt-3">
                    <div className="h-3 w-16 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.1 + 0.35}s` }} />
                    <div className="h-3 w-24 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.1 + 0.4}s` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Community section skeleton */}
        <section>
          <div className="h-4 w-28 skeleton-shimmer rounded mb-4" style={{ animationDelay: "0.45s" }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--twilight)] overflow-hidden"
                style={{ backgroundColor: "var(--card-bg)" }}
              >
                {/* Cover image skeleton */}
                <div className="aspect-[2/1] skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.5}s` }} />

                {/* Content skeleton */}
                <div className="p-4 space-y-2">
                  <div className="h-5 skeleton-shimmer rounded w-3/4" style={{ animationDelay: `${i * 0.05 + 0.55}s` }} />
                  <div className="h-3 skeleton-shimmer rounded w-full" style={{ animationDelay: `${i * 0.05 + 0.6}s` }} />
                  <div className="flex items-center gap-3 mt-3">
                    <div className="h-3 w-12 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.05 + 0.65}s` }} />
                    <div className="h-3 w-20 skeleton-shimmer rounded" style={{ animationDelay: `${i * 0.05 + 0.7}s` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
