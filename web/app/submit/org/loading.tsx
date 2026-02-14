"use client";

import UnifiedHeader from "@/components/UnifiedHeader";
import Skeleton from "@/components/Skeleton";

export default function SubmitOrgLoading() {
  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Skeleton className="h-4 w-32 rounded mb-6" />

        {/* Title */}
        <Skeleton className="h-8 w-52 rounded mb-2" delay="0.05s" />
        <Skeleton className="h-4 w-72 rounded mb-8" delay="0.1s" />

        {/* Form fields */}
        <div className="space-y-6">
          <div>
            <Skeleton className="h-3 w-32 rounded mb-2" delay="0.15s" />
            <Skeleton className="h-11 w-full rounded-lg" delay="0.2s" />
          </div>
          <div>
            <Skeleton className="h-3 w-28 rounded mb-2" delay="0.25s" />
            <Skeleton className="h-11 w-full rounded-lg" delay="0.3s" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 rounded mb-2" delay="0.35s" />
            <Skeleton className="h-11 w-full rounded-lg" delay="0.4s" />
          </div>
          <div>
            <Skeleton className="h-3 w-20 rounded mb-2" delay="0.45s" />
            <Skeleton className="h-28 w-full rounded-lg" delay="0.5s" />
          </div>
        </div>
      </main>
    </div>
  );
}
