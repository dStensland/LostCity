/**
 * Layout-preserving loading skeleton for detail views.
 * Replaces the coral spinner used across EventDetailView,
 * FestivalDetailView, PlaceDetailView, SeriesDetailView, and
 * OrgDetailView. Keeps perceived layout continuity on mobile
 * first-loads so the premium feel doesn't collapse to a spinner.
 */
export function DetailLoadingSkeleton() {
  return (
    <div className="relative min-h-[100dvh] bg-[var(--void)]" aria-busy="true" aria-label="Loading">
      {/* Hero skeleton */}
      <div className="w-full h-[300px] lg:h-[55vh] lg:min-h-[400px] lg:max-h-[700px] bg-[var(--twilight)]/40 animate-pulse" />

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Identity skeleton */}
        <div className="pt-6 pb-4 space-y-3">
          <div className="h-8 w-3/4 bg-[var(--twilight)]/40 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-[var(--twilight)]/30 rounded animate-pulse" />
          <div className="flex gap-2 pt-1">
            <div className="h-6 w-16 bg-[var(--twilight)]/30 rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-[var(--twilight)]/30 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Section skeletons */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-6 space-y-3 border-t border-[var(--twilight)]/30">
            <div className="h-3 w-24 bg-[var(--twilight)]/40 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-[var(--twilight)]/25 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-[var(--twilight)]/25 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-[var(--twilight)]/25 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
