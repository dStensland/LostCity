"use client";

/**
 * LiveTonightHeroStrip — "This Week · N headliners" hero row above the playbill.
 *
 * Density-fix posture: the strip is ALWAYS landscape, regardless of count.
 * Total strip height matches the cinema widget's hero band (~180-220px).
 *
 * - 1 show:  full-width 16/9 tile.
 * - 2 shows: side-by-side, each 16/9 (narrower).
 * - 3 shows: side-by-side, three 16/9 (narrowest). On mobile only the FIRST
 *   TWO render — the spec drops the 3rd tile, no carousel mask-fade.
 * - Eyebrow row: "THIS WEEK · N HEADLINERS" mono soft on the left,
 *   optional editorial micro-copy ("Not to miss.") on the right in muted.
 *
 * Tiles touch (gap-px on a void background creates a hairline divider).
 * The strip is height-capped via `max-h-[200px]` on the grid so it can
 * NEVER blow past the cinema widget's hero band.
 */

import { LiveTonightHeroTile } from "./LiveTonightHeroTile";
import type { MusicShowPayload } from "@/lib/music/types";

export interface LiveTonightHeroStripProps {
  shows: MusicShowPayload[];
  portalSlug: string;
  onTileTap: (show: MusicShowPayload) => void;
}

export function LiveTonightHeroStrip({ shows, portalSlug, onTileTap }: LiveTonightHeroStripProps) {
  if (shows.length === 0) return null;

  const n = Math.min(shows.length, 3) as 1 | 2 | 3;
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
    <section aria-label="This week's significant shows" className="mb-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)]">
          This Week · {visible.length} Headliner{visible.length === 1 ? "" : "s"}
        </span>
        <span className="text-xs italic text-[var(--muted)]">Not to miss.</span>
      </div>

      <div className={`${gridClass} gap-px bg-[var(--void)] motion-stagger max-h-[200px] overflow-hidden`}>
        {visible.map((show, idx) => (
          <div
            key={show.id}
            className={n === 3 && idx === 2 ? "hidden sm:block" : ""}
          >
            <LiveTonightHeroTile
              show={show}
              portalSlug={portalSlug}
              onTap={onTileTap}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
