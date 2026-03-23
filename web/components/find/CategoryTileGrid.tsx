"use client";

import { useMemo } from "react";
import LazyImage from "@/components/LazyImage";
import CategoryIcon from "@/components/CategoryIcon";
import { THINGS_TO_DO_TILES, type Spot, type ThingsToDoTile } from "@/lib/spots-constants";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryTileGridProps {
  spots: Spot[];
  onCategorySelect: (venueTypes: string[]) => void;
  loading?: boolean;
}

type ResolvedTile = ThingsToDoTile & {
  count: number;
  eventCount: number;
  sampleNames: string[];
  imageUrl: string | null;
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TileSkeleton({ index }: { index: number }) {
  return (
    <div
      className="aspect-[4/3] rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 skeleton-shimmer"
      style={{ animationDelay: `${index * 80}ms` }}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CategoryTileGrid({ spots, onCategorySelect, loading }: CategoryTileGridProps) {
  // Build a venue_type → spots lookup
  const tiles = useMemo<ResolvedTile[]>(() => {
    const typeMap = new Map<string, Spot[]>();
    for (const spot of spots) {
      const vt = spot.venue_type;
      if (!vt) continue;
      if (!typeMap.has(vt)) typeMap.set(vt, []);
      typeMap.get(vt)!.push(spot);
    }

    const resolved: ResolvedTile[] = [];
    for (const tile of THINGS_TO_DO_TILES) {
      let count = 0;
      let eventCount = 0;
      let imageUrl: string | null = null;
      const allSpots: Spot[] = [];
      for (const vt of tile.venueTypes) {
        const group = typeMap.get(vt);
        if (!group) continue;
        count += group.length;
        for (const s of group) {
          eventCount += s.event_count || 0;
          allSpots.push(s);
        }
        if (!imageUrl) {
          const withImg = group.find((s) => s.image_url);
          if (withImg) imageUrl = withImg.image_url;
        }
      }
      // Pick top 2 venues by event count for name recognition
      const sampleNames = allSpots
        .sort((a, b) => (b.event_count || 0) - (a.event_count || 0))
        .slice(0, 2)
        .map((s) => s.name);
      if (count > 0) {
        resolved.push({ ...tile, count, eventCount, sampleNames, imageUrl });
      }
    }
    return resolved;
  }, [spots]);

  if (loading && spots.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
        {Array.from({ length: 8 }, (_, i) => (
          <TileSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
      {tiles.map((tile) => {
        const colorClass = createCssVarClass("--tile-accent", tile.color, "tile");
        return (
          <div key={tile.key}>
            <ScopedStyles css={colorClass?.css} />
            <button
              onClick={() => onCategorySelect([...tile.venueTypes])}
              className={`relative w-full aspect-[4/3] rounded-card overflow-hidden shadow-card-sm hover-lift focus-ring transition-transform active:scale-[0.97] bg-[var(--night)] ${colorClass?.className ?? ""}`}
            >
              {/* Image or gradient fallback */}
              {tile.imageUrl ? (
                <LazyImage
                  src={tile.imageUrl}
                  alt={tile.label}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="absolute inset-0"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${tile.color}40, ${tile.color}18)`,
                  }}
                />
              )}

              {/* Bottom gradient overlay */}
              <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

              {/* Fallback icon (shown when no image) */}
              {!tile.imageUrl && (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <CategoryIcon type={tile.iconType} size={48} glow="none" weight="thin" />
                </div>
              )}

              {/* Label + metadata */}
              <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                <h3 className="text-sm font-semibold text-white leading-tight line-clamp-1">
                  {tile.label}
                </h3>
                {tile.sampleNames.length > 0 && (
                  <p className="text-2xs text-white/50 mt-0.5 line-clamp-1">
                    {tile.sampleNames.join(" · ")}
                  </p>
                )}
                <p className="text-xs text-white/70 font-mono mt-1 flex items-center gap-1.5">
                  <span>{tile.count} {tile.count === 1 ? "spot" : "spots"}</span>
                  {tile.eventCount > 0 && (
                    <>
                      <span className="text-white/30">·</span>
                      <span>{tile.eventCount} {tile.eventCount === 1 ? "event" : "events"}</span>
                    </>
                  )}
                </p>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
