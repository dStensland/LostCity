"use client";

import Skeleton from "@/components/Skeleton";

/**
 * Approximate rendered height of a single HeroCard.
 * The real component wraps everything in h-[200px] sm:h-[240px].
 * Mobile: 200px, desktop: 240px. Use the mobile value as the constant
 * since it's the floor — the component matches exactly via the same height classes.
 */
export const HERO_CARD_SKELETON_HEIGHT = 200; // px, matches h-[200px] mobile

/**
 * Content-matched skeleton for HeroCard.
 * Mirrors the image-mode layout: full-bleed photo area with bottom overlay
 * containing label, title, metadata, and optional social proof.
 *
 * Height is fixed to match the real component: h-[200px] sm:h-[240px].
 */
export function HeroCardSkeleton({ delay = "0s" }: { delay?: string }) {
  return (
    <div className="relative w-full rounded-card overflow-hidden">
      {/* Image area — fixed height matching real component */}
      <div className="relative w-full h-[200px] sm:h-[240px]">
        {/* Full-bleed shimmer */}
        <Skeleton
          variant="rect"
          className="absolute inset-0 w-full h-full rounded-none"
          delay={delay}
        />

        {/* Gradient overlay — bottom half, matches real gradient treatment */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/40 to-transparent pointer-events-none" />

        {/* Bottom overlay: label + title + metadata */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-2 space-y-1.5">
          {/* Contextual label (FESTIVAL / FREE / category) */}
          <Skeleton
            variant="rect"
            className="h-3 w-14 rounded"
            delay={delay}
          />

          {/* Title — text-2xl, line-clamp-2 */}
          <Skeleton
            variant="rect"
            className="h-6 w-[72%] rounded"
            delay={delay}
          />
          <Skeleton
            variant="rect"
            className="h-6 w-[48%] rounded sm:hidden"
            delay={delay}
          />

          {/* Metadata row: venue · date · price */}
          <div className="flex items-center gap-2 pt-0.5">
            <Skeleton variant="rect" className="h-3.5 w-24 rounded" delay={delay} />
            <Skeleton variant="rect" className="h-3.5 w-20 rounded" delay={delay} />
            <Skeleton variant="rect" className="h-3.5 w-14 rounded hidden sm:block" delay={delay} />
          </div>
        </div>
      </div>
    </div>
  );
}
