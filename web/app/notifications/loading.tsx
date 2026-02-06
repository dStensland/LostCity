import Skeleton from "@/components/Skeleton";

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen">
      {/* Header placeholder - UnifiedHeader renders on its own */}
      <div className="h-16" />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-40 skeleton-shimmer rounded" />
          <Skeleton className="h-4 w-28 rounded" delay="0.05s" />
        </div>

        {/* Notifications list skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg"
            >
              <div className="flex gap-4">
                <Skeleton className="w-10 h-10 rounded-full" delay={`${i * 0.05}s`} />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 rounded w-3/4" delay={`${i * 0.05 + 0.05}s`} />
                  <Skeleton className="h-3 rounded w-20" delay={`${i * 0.05 + 0.1}s`} />
                </div>
                <div className="flex-shrink-0 self-center">
                  <Skeleton className="w-2.5 h-2.5 rounded-full" delay={`${i * 0.05 + 0.15}s`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
