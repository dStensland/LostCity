"use client";

export default function TrendingNowSkeleton() {
  return (
    <section className="py-4 border-b border-[var(--twilight)]">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded skeleton-shimmer" />
          <div className="h-3 w-24 rounded skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
          <div className="h-4 w-8 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
        </div>

        {/* Horizontal scroll cards skeleton */}
        <div className="flex gap-3 overflow-hidden -mx-4 px-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 p-3 rounded-lg border border-[var(--twilight)]"
              style={{ backgroundColor: "var(--dusk)" }}
            >
              <div className="flex items-start gap-3">
                {/* Trending icon skeleton */}
                <div className="flex-shrink-0 w-10">
                  <div className="w-8 h-8 rounded-full skeleton-shimmer" style={{ animationDelay: `${i * 0.08}s` }} />
                </div>

                {/* Content skeleton */}
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-full rounded skeleton-shimmer mb-1" style={{ animationDelay: `${i * 0.08 + 0.05}s` }} />
                  <div className="h-4 w-3/4 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.08 + 0.1}s` }} />

                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full skeleton-shimmer" style={{ animationDelay: `${i * 0.08 + 0.15}s` }} />
                    <div className="h-3 w-24 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.08 + 0.2}s` }} />
                  </div>

                  <div className="h-3 w-20 rounded skeleton-shimmer mt-1" style={{ animationDelay: `${i * 0.08 + 0.25}s` }} />

                  {/* Stats skeleton */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-3 w-14 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.08 + 0.3}s` }} />
                    <div className="h-3 w-16 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.08 + 0.35}s` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
