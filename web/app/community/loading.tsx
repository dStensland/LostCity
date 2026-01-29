/**
 * Loading skeleton for community pages.
 * Uses Next.js 13+ streaming with Suspense for better perceived performance.
 */
export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-[var(--void)]">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-48 rounded skeleton-shimmer mb-2" />
          <div className="h-4 w-64 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
        </div>

        {/* Search skeleton */}
        <div className="mb-6">
          <div className="h-12 w-full rounded-lg skeleton-shimmer" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 rounded-lg skeleton-shimmer"
              style={{
                width: `${70 + i * 15}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>

        {/* Community cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg skeleton-shimmer" />
                <div className="flex-1">
                  <div className="h-5 w-40 rounded skeleton-shimmer mb-2" />
                  <div className="h-3 w-24 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
                </div>
                <div className="h-8 w-20 rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
