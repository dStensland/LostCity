"use client";

import { memo } from "react";
import type { VerticalLane } from "@/lib/types/discovery";
import { useLaneSpots } from "@/lib/hooks/useLaneSpots";
import { LaneFilterBar } from "./LaneFilterBar";
import { ExpandedPlaceCard } from "@/components/cards/ExpandedPlaceCard";

// -------------------------------------------------------------------------
// Skeleton cards
// -------------------------------------------------------------------------

function LaneViewSkeleton() {
  return (
    <div className="space-y-3 mt-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[200px] rounded-[12px] bg-[var(--dusk)] animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

// -------------------------------------------------------------------------
// LaneView
// -------------------------------------------------------------------------

interface LaneViewProps {
  lane: VerticalLane;
  portalSlug: string;
}

export const LaneView = memo(function LaneView({
  lane,
  portalSlug,
}: LaneViewProps) {
  const { items, totalCount, openCount, loading, error } = useLaneSpots(
    portalSlug,
    lane,
    60,
  );

  return (
    <div>
      {/* Filter bar — always visible, even while loading */}
      <LaneFilterBar
        lane={lane}
        portalSlug={portalSlug}
        totalCount={loading ? 0 : totalCount}
        openCount={loading ? 0 : openCount}
      />

      {/* Content */}
      {loading ? (
        <LaneViewSkeleton />
      ) : error ? (
        <div className="mt-8 py-12 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            Couldn&apos;t load places — try again
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 py-12 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            No places found
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((entity) => (
            <ExpandedPlaceCard
              key={`place-${entity.id}`}
              entity={entity}
              portalSlug={portalSlug}
              lane={lane}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export type { LaneViewProps };
