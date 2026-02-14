"use client";

import UnifiedHeader from "@/components/UnifiedHeader";
import Skeleton from "@/components/Skeleton";

export default function SubmitLoading() {
  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Skeleton className="h-8 w-56 rounded mb-3" />
          <Skeleton className="h-4 w-80 rounded" delay="0.05s" />
        </div>

        {/* Status card */}
        <div className="mb-8 p-6 rounded-xl bg-[var(--void)]/60 border border-[var(--twilight)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Skeleton className="h-3 w-36 rounded mb-2" delay="0.1s" />
              <Skeleton className="h-5 w-40 rounded mb-2" delay="0.15s" />
              <Skeleton className="h-3 w-64 rounded" delay="0.2s" />
            </div>
            <Skeleton className="h-9 w-36 rounded-lg" delay="0.15s" />
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[var(--dusk)]/70 border border-[var(--twilight)]"
              >
                <Skeleton className="h-3 w-16 rounded mb-2" delay={`${i * 0.05 + 0.25}s`} />
                <Skeleton className="h-4 w-8 rounded" delay={`${i * 0.05 + 0.3}s`} />
              </div>
            ))}
          </div>
        </div>

        {/* Submission type cards */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]"
            >
              <div className="flex items-start gap-4">
                <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" delay={`${i * 0.08 + 0.4}s`} />
                <div className="flex-1">
                  <Skeleton className="h-5 w-36 rounded mb-2" delay={`${i * 0.08 + 0.45}s`} />
                  <Skeleton className="h-3 w-64 rounded" delay={`${i * 0.08 + 0.5}s`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
