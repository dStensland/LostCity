"use client";

import Skeleton from "@/components/Skeleton";

/**
 * Approximate rendered height of a single StandardRow.
 * The real component is: rounded-lg, px-3 py-2, flex items-center.
 * Title is text-sm (leading-snug ~1.375) + meta text-xs (leading-snug ~1.375).
 * Two lines at 13px + 11px with 1.375 leading = ~17.9px + ~15.1px = ~33px
 * Plus py-2 (8px * 2) = 16px total vertical padding → ~49px.
 * Round up to 52px to account for border.
 */
export const STANDARD_ROW_SKELETON_HEIGHT = 52; // px

/**
 * Content-matched skeleton for StandardRow.
 * Mirrors the compact single-line row layout:
 * [2px accent bar] [title / meta text] [right-side badges]
 */
export function StandardRowSkeleton({ delay = "0s" }: { delay?: string }) {
  return (
    <div className="rounded-lg bg-[var(--night)] border border-[var(--twilight)]/40 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        {/* Left: accent bar + text content */}
        <div className="flex items-stretch gap-3 min-w-0 flex-1">
          {/* 2px category accent bar */}
          <Skeleton
            variant="rect"
            className="w-0.5 self-stretch rounded-full flex-shrink-0"
            delay={delay}
          />

          {/* Title + meta stacked */}
          <div className="min-w-0 space-y-1.5 py-0.5">
            {/* Title line */}
            <Skeleton variant="rect" className="h-[13px] w-[55%] rounded" delay={delay} />
            {/* Meta line (venue · time) */}
            <Skeleton variant="rect" className="h-[11px] w-[35%] rounded" delay={delay} />
          </div>
        </div>

        {/* Right: price badge placeholder */}
        <div className="flex-shrink-0">
          <Skeleton variant="rect" className="h-4 w-10 rounded-full" delay={delay} />
        </div>
      </div>
    </div>
  );
}
