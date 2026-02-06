import Skeleton from "@/components/Skeleton";

export default function CollectionsLoading() {
  return (
    <div className="min-h-screen">
      {/* Header placeholder - UnifiedHeader renders on its own */}
      <div className="h-16" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-8 w-32 rounded" />
          <Skeleton className="h-10 w-36 rounded-lg" delay="0.05s" />
        </div>

        {/* Featured section skeleton */}
        <section className="mb-10">
          <Skeleton className="h-4 w-24 rounded mb-4" delay="0.1s" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg)]"
              >
                {/* Cover image skeleton */}
                <Skeleton className="aspect-[2/1]" delay={`${i * 0.1 + 0.15}s`} />

                {/* Content skeleton */}
                <div className="p-6 space-y-3">
                  <Skeleton className="h-4 w-20 rounded mb-2" delay={`${i * 0.1 + 0.2}s`} />
                  <Skeleton className="h-6 rounded w-3/4" delay={`${i * 0.1 + 0.25}s`} />
                  <Skeleton className="h-3 rounded w-full" delay={`${i * 0.1 + 0.3}s`} />
                  <div className="flex items-center gap-3 mt-3">
                    <Skeleton className="h-3 w-16 rounded" delay={`${i * 0.1 + 0.35}s`} />
                    <Skeleton className="h-3 w-24 rounded" delay={`${i * 0.1 + 0.4}s`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Community section skeleton */}
        <section>
          <Skeleton className="h-4 w-28 rounded mb-4" delay="0.45s" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg)]"
              >
                {/* Cover image skeleton */}
                <Skeleton className="aspect-[2/1]" delay={`${i * 0.05 + 0.5}s`} />

                {/* Content skeleton */}
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 rounded w-3/4" delay={`${i * 0.05 + 0.55}s`} />
                  <Skeleton className="h-3 rounded w-full" delay={`${i * 0.05 + 0.6}s`} />
                  <div className="flex items-center gap-3 mt-3">
                    <Skeleton className="h-3 w-12 rounded" delay={`${i * 0.05 + 0.65}s`} />
                    <Skeleton className="h-3 w-20 rounded" delay={`${i * 0.05 + 0.7}s`} />
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
