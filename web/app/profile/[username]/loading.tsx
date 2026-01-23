import UnifiedHeader from "@/components/UnifiedHeader";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[var(--void)]">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Profile header skeleton */}
        <div className="flex items-start gap-4 mb-8">
          {/* Avatar skeleton */}
          <div className="w-20 h-20 rounded-full bg-[var(--twilight)] skeleton-shimmer" />

          <div className="flex-1">
            {/* Name skeleton */}
            <div className="h-7 w-40 bg-[var(--twilight)] rounded skeleton-shimmer mb-2" />
            {/* Username skeleton */}
            <div className="h-4 w-24 bg-[var(--twilight)] rounded skeleton-shimmer mb-3" />
            {/* Bio skeleton */}
            <div className="h-4 w-full bg-[var(--twilight)] rounded skeleton-shimmer mb-1" />
            <div className="h-4 w-2/3 bg-[var(--twilight)] rounded skeleton-shimmer" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="flex gap-6 mb-8 pb-6 border-b border-[var(--twilight)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="h-6 w-8 bg-[var(--twilight)] rounded skeleton-shimmer mx-auto mb-1" />
              <div className="h-3 w-16 bg-[var(--twilight)] rounded skeleton-shimmer" />
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-20 bg-[var(--twilight)] rounded skeleton-shimmer" />
          ))}
        </div>

        {/* Activity list skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-[var(--twilight)] skeleton-shimmer flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-[var(--twilight)] rounded skeleton-shimmer mb-2" />
                  <div className="h-3 w-1/2 bg-[var(--twilight)] rounded skeleton-shimmer" />
                </div>
                <div className="h-3 w-12 bg-[var(--twilight)] rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
