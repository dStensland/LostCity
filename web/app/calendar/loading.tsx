import Skeleton from "@/components/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Skeleton className="h-8 w-40 rounded mb-2" />
          <Skeleton className="h-4 w-56 rounded" delay="0.05s" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-10 w-32 rounded-lg" delay="0.1s" />
          <Skeleton className="h-10 w-24 rounded-lg" delay="0.15s" />
          <Skeleton className="h-10 w-20 rounded-lg" delay="0.2s" />
        </div>
      </div>

      {/* Status filter tabs skeleton */}
      <div className="flex items-center gap-1 mb-6 bg-[var(--deep-violet)] rounded-lg p-1 w-fit">
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            className="h-9 w-24 rounded-md"
            delay={`${i * 0.05 + 0.25}s`}
          />
        ))}
      </div>

      {/* Calendar grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Main calendar */}
        <div className="bg-gradient-to-br from-[var(--deep-violet)] to-[var(--midnight-blue)] rounded-xl p-6 border border-[var(--nebula)]">
          {/* Month header skeleton */}
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-40 rounded" delay="0.3s" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-9 w-9 rounded-lg" delay="0.35s" />
              <Skeleton className="h-9 w-9 rounded-lg" delay="0.4s" />
            </div>
          </div>

          {/* Week day headers skeleton */}
          <div className="grid grid-cols-7 mb-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="py-2 text-center">
                <Skeleton className="h-3 w-8 mx-auto rounded" delay={`${i * 0.03 + 0.45}s`} />
              </div>
            ))}
          </div>

          {/* Calendar days skeleton */}
          <div className="grid grid-cols-7 gap-1">
            {[...Array(42)].map((_, i) => (
              <div
                key={i}
                className="aspect-square p-1 rounded-lg bg-[var(--twilight-purple)]/30"
              >
                <Skeleton className="h-4 w-6 rounded mb-1" delay={`${(i % 14) * 0.02}s`} />
              </div>
            ))}
          </div>

          {/* Legend skeleton */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="w-3 h-3 rounded" delay={`${i * 0.05 + 0.7}s`} />
                <Skeleton className="h-3 w-12 rounded" delay={`${i * 0.05 + 0.75}s`} />
              </div>
            ))}
          </div>
        </div>

        {/* Selected day detail skeleton */}
        <div className="bg-gradient-to-br from-[var(--deep-violet)] to-[var(--midnight-blue)] rounded-xl p-6 border border-[var(--nebula)] h-fit lg:sticky lg:top-20">
          <Skeleton className="h-4 w-24 rounded mb-2" delay="0.8s" />
          <Skeleton className="h-6 w-40 rounded mb-4" delay="0.85s" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-[var(--nebula)] bg-[var(--cosmic-blue)]/30 border-l-[3px]"
              >
                <Skeleton className="h-3 w-16 rounded mb-2" delay={`${i * 0.1 + 0.9}s`} />
                <Skeleton className="h-4 w-full rounded mb-1" delay={`${i * 0.1 + 0.95}s`} />
                <Skeleton className="h-3 w-24 rounded" delay={`${i * 0.1 + 1}s`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
