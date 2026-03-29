"use client";

import { useState, useEffect, useRef } from "react";
import type { DiscoveryPlaceEntity, VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG } from "@/lib/types/discovery";

export interface UseLaneSpotsResult {
  items: DiscoveryPlaceEntity[];
  loading: boolean;
  error: boolean;
  totalCount: number;
  openCount: number;
}

export function useLaneSpots(
  portalSlug: string,
  lane: VerticalLane,
  limit = 3,
): UseLaneSpotsResult {
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
      limit: String(limit),
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
        console.error(`[useLaneSpots:${lane}] fetch error:`, err);
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
  }, [portalSlug, lane, limit]);

  return { items, loading, error, totalCount, openCount };
}
