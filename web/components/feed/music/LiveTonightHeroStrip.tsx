"use client";

/**
 * LiveTonightHeroStrip — "This Week · N headliners" hero row above the playbill.
 *
 * Per spec (`docs/design-specs/live-tonight-widget-{desktop,mobile}.md`):
 * - 1 show: single landscape (16/9) tile, full width.
 * - 2 shows: 2-up portrait grid, both visible on mobile and desktop.
 * - 3 shows: 3-up portrait grid on desktop. On mobile only the FIRST TWO
 *   render — the spec drops the 3rd tile, no carousel mask-fade.
 * - Eyebrow row: "THIS WEEK · N HEADLINERS" mono soft on the left,
 *   optional editorial micro-copy ("Not to miss.") on the right in muted.
 *
 * Tiles touch (gap-px on a void background creates a hairline divider — no
 * card radius / shadow per cinematic-minimalism posture).
 */

import { LiveTonightHeroTile, type LiveTonightHeroAspect } from "./LiveTonightHeroTile";
import type { MusicShowPayload } from "@/lib/music/types";

export interface LiveTonightHeroStripProps {
  shows: MusicShowPayload[];
  portalSlug: string;
  onTileTap: (show: MusicShowPayload) => void;
}

const ASPECT_BY_COUNT: Record<1 | 2 | 3, LiveTonightHeroAspect> = {
  1: "landscape",
  2: "portrait",
  3: "portrait",
};

export function LiveTonightHeroStrip({ shows, portalSlug, onTileTap }: LiveTonightHeroStripProps) {
  if (shows.length === 0) return null;

  const n = Math.min(shows.length, 3) as 1 | 2 | 3;
  const aspectVariant = ASPECT_BY_COUNT[n];
  const visible = shows.slice(0, n);

  // Mobile: drop the 3rd tile entirely (per spec). Desktop: show all N.
  // We render all N tiles but hide the 3rd at <sm with `hidden sm:block`.
  const gridClass =
    n === 1
      ? "grid grid-cols-1"
      : n === 2
        ? "grid grid-cols-2"
        : "grid grid-cols-2 sm:grid-cols-3";

  return (
    <section aria-label="This week's significant shows" className="mb-2">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)]">
          This Week · {visible.length} Headliner{visible.length === 1 ? "" : "s"}
        </span>
        <span className="text-xs italic text-[var(--muted)]">Not to miss.</span>
      </div>

      <div className={`${gridClass} gap-px bg-[var(--void)] motion-stagger`}>
        {visible.map((show, idx) => (
          <div
            key={show.id}
            className={
              n === 3 && idx === 2
                ? "hidden sm:block"
                : ""
            }
          >
            <LiveTonightHeroTile
              show={show}
              portalSlug={portalSlug}
              onTap={onTileTap}
              aspectVariant={aspectVariant}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
