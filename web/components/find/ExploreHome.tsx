"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FindSearchInput from "@/components/find/FindSearchInput";
import { BROWSE_LANES, VIEW_LANES, LANE_META, LANE_ICONS } from "@/lib/explore-lane-meta";
import type { ExploreHomeResponse } from "@/lib/types/explore-home";


// ---------------------------------------------------------------------------
// Capitalize portal slug for display (e.g. "atlanta" → "Atlanta")
// ---------------------------------------------------------------------------

function formatPortalLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// ---------------------------------------------------------------------------
// ExploreHome — search-forward layout
// ---------------------------------------------------------------------------

export interface ExploreHomeProps {
  portalSlug: string;
  portalId: string;
  data: ExploreHomeResponse | null;
  loading: boolean;
  onRetry?: () => void;
}

export function ExploreHome({
  portalSlug,
  portalId,
  data,
  loading,
  onRetry,
}: ExploreHomeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldFocusSearch = searchParams?.get("focus") === "search";

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto px-4 py-8 min-h-[calc(100vh-5rem)]">
      {/* Search hero */}
      <div className="text-center">
        <p className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--muted)] mb-3">
          Explore {formatPortalLabel(portalSlug)}
        </p>
        <Suspense fallback={<div className="h-12 bg-[var(--night)] rounded-xl" />}>
          <FindSearchInput
            portalSlug={portalSlug}
            portalId={portalId}
            placeholder="Search places, events, classes..."
            autoFocus={shouldFocusSearch}
          />
        </Suspense>
      </div>


      {/* Error state */}
      {!loading && !data && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--soft)]">
            Could not load explore sections.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-xs font-mono text-[var(--coral)] hover:opacity-80 transition-opacity"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Lane tile grid */}
      <div className="grid grid-cols-2 gap-2">
        {BROWSE_LANES.map((slug) => {
          const meta = LANE_META[slug];
          const Icon = LANE_ICONS[slug];
          const laneData = data?.lanes?.[slug];
          const count = laneData?.count ?? 0;
          const isZero = count === 0 && !loading;

          return (
            <a
              key={slug}
              href={meta.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(meta.href);
              }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                isZero
                  ? "opacity-50 border-[var(--twilight)]/20 bg-transparent"
                  : "border-[var(--twilight)]/30 hover:border-[var(--twilight)]/80"
              }`}
              style={{
                background: isZero
                  ? "transparent"
                  : `color-mix(in srgb, ${meta.accent} 8%, transparent)`,
              }}
            >
              <Icon
                size={22}
                weight="duotone"
                className="flex-shrink-0"
                style={{ color: meta.accent }}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--cream)] truncate">
                  {meta.mobileLabel}
                </div>
                {!isZero && count > 0 && (
                  <div
                    className="text-2xs font-mono"
                    style={{ color: meta.accent }}
                  >
                    {laneData?.copy || `${count.toLocaleString()}`}
                  </div>
                )}
                {loading && (
                  <div className="h-3 w-16 rounded bg-[var(--twilight)]/30 animate-pulse" />
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* Utility links: Calendar & Map */}
      <div className="flex gap-4 justify-center">
        {VIEW_LANES.map((slug) => {
          const meta = LANE_META[slug];
          const Icon = LANE_ICONS[slug];
          return (
            <a
              key={slug}
              href={meta.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(meta.href);
              }}
              className="flex items-center gap-1.5 text-sm text-[var(--soft)]
                hover:text-[var(--cream)] transition-colors"
            >
              <Icon size={16} weight="duotone" />
              {meta.mobileLabel}
            </a>
          );
        })}
      </div>
    </div>
  );
}
