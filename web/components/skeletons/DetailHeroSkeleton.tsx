"use client";

import Skeleton from "@/components/Skeleton";

/**
 * Approximate rendered height of DetailHero in "image" mode (aspect-video).
 * At the max-w-3xl container (~672px) a 16:9 image = ~378px.
 * The overlay content adds ~4px for the bottom accent bar.
 * In "poster" mode the height varies by content but falls in a similar range.
 */
export const DETAIL_HERO_SKELETON_HEIGHT = 380; // px, matches image mode aspect-video

/**
 * Content-matched skeleton for DetailHero.
 * Mirrors the "image" mode layout: full-width aspect-video block + bottom
 * overlay strip that holds badge, title, subtitle, and action row.
 *
 * The overlay sits inside the image area (absolute), so the total height
 * is purely determined by the aspect ratio — same as the real component.
 */
export function DetailHeroSkeleton() {
  return (
    <div className="relative w-full aspect-video sm:rounded-xl overflow-hidden bg-[var(--night)]">
      {/* Full-bleed image placeholder — shimmer over the entire hero area */}
      <Skeleton
        variant="rect"
        className="absolute inset-0 w-full h-full rounded-none sm:rounded-xl"
      />

      {/* Overlay gradient — mirrors real component's bottom gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)]/80 via-[var(--night)]/20 to-transparent pointer-events-none" />

      {/* Bottom overlay content — badge + title + metadata */}
      <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 sm:pb-5 pt-14 space-y-2">
        {/* Badge (optional contextual label) */}
        <Skeleton variant="rect" className="h-4 w-16 rounded" delay="0.05s" />

        {/* Title bar */}
        <Skeleton variant="rect" className="h-6 sm:h-7 w-3/4 rounded" delay="0.1s" />

        {/* Subtitle / metadata row */}
        <div className="flex items-center gap-3 pt-0.5">
          <Skeleton variant="rect" className="h-3.5 w-28 rounded" delay="0.15s" />
          <Skeleton variant="rect" className="h-3.5 w-20 rounded" delay="0.17s" />
          <Skeleton variant="rect" className="h-3.5 w-16 rounded hidden sm:block" delay="0.19s" />
        </div>
      </div>

      {/* Bottom accent bar — 3px bar at very bottom (always present) */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--twilight)]" />
    </div>
  );
}
