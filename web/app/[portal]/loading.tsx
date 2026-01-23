"use client";

import UnifiedHeader from "@/components/UnifiedHeader";
import { useParams } from "next/navigation";

export default function PortalLoading() {
  const params = useParams();
  const portalSlug = (params?.portal as string) || "atlanta";

  return (
    <div className="min-h-screen">
      <UnifiedHeader portalSlug={portalSlug} />

      {/* Search bar skeleton */}
      <div className="border-b border-[var(--twilight)] bg-[var(--night)]/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="h-10 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="border-b border-[var(--twilight)] bg-[var(--night)]/80">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 w-20 rounded-full skeleton-shimmer flex-shrink-0"
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Event cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="border border-[var(--twilight)] rounded-lg p-4 animate-card-emerge"
              style={{
                backgroundColor: "var(--card-bg)",
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div className="flex gap-4">
                {/* Date column */}
                <div className="flex-shrink-0 w-14 text-center">
                  <div className="h-4 w-8 mx-auto rounded skeleton-shimmer mb-1" />
                  <div className="h-8 w-10 mx-auto rounded skeleton-shimmer" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Category badge */}
                  <div className="h-4 w-16 rounded skeleton-shimmer mb-2" />
                  {/* Title */}
                  <div className="h-5 w-3/4 rounded skeleton-shimmer mb-2" />
                  {/* Venue */}
                  <div className="h-4 w-1/2 rounded skeleton-shimmer" />
                </div>

                {/* Image placeholder */}
                <div className="flex-shrink-0 w-20 h-20 rounded-lg skeleton-shimmer hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
