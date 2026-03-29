"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { DiscoveryPlaceEntity, VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG } from "@/lib/types/discovery";
import { LaneFilterBar } from "./LaneFilterBar";
import { ExpandedPlaceCard } from "@/components/cards/ExpandedPlaceCard";

// -------------------------------------------------------------------------
// Fetch hook
// -------------------------------------------------------------------------

interface UseLaneViewSpotsResult {
  items: DiscoveryPlaceEntity[];
  totalCount: number;
  openCount: number;
  loading: boolean;
  error: boolean;
}

function useLaneViewSpots(
  portalSlug: string,
  lane: VerticalLane,
): UseLaneViewSpotsResult {
  const [items, setItems] = useState<DiscoveryPlaceEntity[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    const config = LANE_CONFIG[lane];
    const params = new URLSearchParams({
      portal: portalSlug,
      place_type: config.placeTypes.join(","),
      limit: "60",
    });

    async function run() {
      try {
        const res = await fetch(`/api/spots?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`spots: ${res.status}`);
        const data = (await res.json()) as {
          spots?: DiscoveryPlaceEntity[];
          meta?: { total?: number; openCount?: number };
        };
        const spots: DiscoveryPlaceEntity[] = data.spots ?? [];
        const total = data.meta?.total ?? spots.length;
        const open = data.meta?.openCount ?? spots.filter((s) => s.is_open).length;
        setItems(spots);
        setTotalCount(total);
        setOpenCount(open);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error(`[LaneView:${lane}] fetch error:`, err);
        setError(true);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, [portalSlug, lane]);

  return { items, totalCount, openCount, loading, error };
}

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
  const { items, totalCount, openCount, loading, error } = useLaneViewSpots(
    portalSlug,
    lane,
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
            Couldn't load places — try again
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
