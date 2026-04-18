"use client";

import { LiveTonightHeroTile, type LiveTonightHeroTileSize } from "./LiveTonightHeroTile";
import type { MusicShowPayload } from "@/lib/music/types";

export interface LiveTonightHeroStripProps {
  shows: MusicShowPayload[];
  portalSlug: string;
  onTileTap: (show: MusicShowPayload) => void;
}

const SIZE_BY_COUNT: Record<1 | 2 | 3, LiveTonightHeroTileSize> = {
  1: "xl",
  2: "lg",
  3: "md",
};

export function LiveTonightHeroStrip({ shows, portalSlug, onTileTap }: LiveTonightHeroStripProps) {
  if (shows.length === 0) return null;

  const n = Math.min(shows.length, 3) as 1 | 2 | 3;
  const sizeVariant = SIZE_BY_COUNT[n];

  return (
    <section aria-label="This week's significant shows" className="mb-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          This Week · {shows.length} significant show{shows.length === 1 ? "" : "s"}
        </div>
        <div className="text-xs italic text-[var(--muted)]">Not to miss.</div>
      </div>

      <div
        className={[
          "grid gap-px bg-black rounded-md overflow-hidden",
          n === 1
            ? "grid-cols-1 h-[240px]"
            : n === 2
            ? "grid-cols-[60fr_40fr] h-[220px]"
            : "grid-cols-3 h-[200px]",
        ].join(" ")}
      >
        {shows.slice(0, n).map((show, i) => (
          <div
            key={show.id}
            className="motion-safe:animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
          >
            <LiveTonightHeroTile
              show={show}
              portalSlug={portalSlug}
              onTap={onTileTap}
              sizeVariant={sizeVariant}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
