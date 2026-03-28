"use client";

import Skeleton from "@/components/Skeleton";

/**
 * Content-aware skeleton for the venue discovery list.
 * Mirrors the DiscoveryCard layout: left accent border, image rail (desktop),
 * category icon, title, subtitle, and meta row — so the skeleton feels like
 * a natural preview of the cards about to appear.
 */

const ACCENT_COLORS = [
  "var(--coral)",
  "var(--neon-cyan)",
  "var(--neon-amber)",
  "var(--neon-green)",
  "var(--coral)",
  "var(--neon-cyan)",
];

function VenueCardSkeleton({ index }: { index: number }) {
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const base = `${index * 0.06}s`;
  const d1 = `${index * 0.06 + 0.04}s`;
  const d2 = `${index * 0.06 + 0.08}s`;
  const d3 = `${index * 0.06 + 0.12}s`;

  return (
    <div
      className="find-row-card-bg rounded-xl border border-[var(--twilight)]/75 border-l-[2px] overflow-hidden"
      style={{
        borderLeftColor: accent,
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
        <div className="min-w-0 p-3 sm:p-3.5">
          <div className="flex gap-2.5 sm:gap-3">
            {/* Image rail — desktop only */}
            <div className="hidden sm:flex flex-shrink-0 self-stretch relative w-[100px] -ml-3 sm:-ml-3.5 -my-3 sm:-my-3.5 overflow-hidden border-r border-[var(--twilight)]/60">
              <Skeleton className="absolute inset-0" delay={base} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Mobile thumbnail */}
              <div className="sm:hidden flex items-center gap-2 mb-2">
                <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" delay={base} />
              </div>

              {/* Title row: icon + name + badge */}
              <div className="flex items-center gap-2.5 mb-1">
                <Skeleton className="hidden sm:block w-8 h-8 rounded-lg flex-shrink-0" delay={base} />
                <Skeleton className="h-5 w-[55%] rounded" delay={d1} />
                <Skeleton className="h-4 w-10 rounded flex-shrink-0" delay={d2} />
              </div>

              {/* Subtitle */}
              <Skeleton className="h-3 w-[40%] rounded mt-1" delay={d2} />

              {/* Meta row */}
              <div className="flex items-center gap-2 mt-2">
                <Skeleton className="h-3 w-16 rounded" delay={d3} />
                <Skeleton className="h-3 w-12 rounded" delay={d3} />
                <Skeleton className="h-3 w-20 rounded hidden sm:block" delay={d3} />
              </div>
            </div>
          </div>
        </div>

        {/* Right arrow area */}
        <div className="flex flex-col items-end gap-2 pt-2.5 pr-2.5 pb-2.5 sm:pt-3 sm:pr-3.5 sm:pb-3 flex-shrink-0">
          <Skeleton className="w-9 h-9 rounded-lg" delay={d1} />
        </div>
      </div>
    </div>
  );
}

export default function PlaceListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3 mt-4">
      {Array.from({ length: count }, (_, i) => (
        <VenueCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}
