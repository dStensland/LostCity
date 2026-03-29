"use client";

import { useEffect, useRef, useState } from "react";
import type { DiscoveryEntity } from "@/lib/types/discovery";

interface UseRightNowResult {
  items: DiscoveryEntity[];
  loading: boolean;
}

/**
 * Fetches the "Right Now" feed from /api/find/right-now.
 * Returns a temporally-ranked mix of upcoming events and open places.
 */
export function useRightNow(
  portalSlug: string,
  limit = 6
): UseRightNowResult {
  const [items, setItems] = useState<DiscoveryEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({
      portal: portalSlug,
      limit: String(limit),
    });

    async function run() {
      try {
        const res = await fetch(`/api/find/right-now?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`right-now: ${res.status}`);
        const data = (await res.json()) as DiscoveryEntity[];
        // Deduplicate: same venue+time (exact dupe) or fuzzy name prefix (title variants)
        const seen = new Set<string>();
        const deduped = data.filter((item: DiscoveryEntity) => {
          if (item.entity_type === "event") {
            // Deduplicate by venue + start time (same show at same place)
            const venueKey = `venue:${(item.venue_name || "").toLowerCase()}_${item.start_time || ""}`;
            if (seen.has(venueKey)) return false;
            seen.add(venueKey);

            // Also deduplicate by fuzzy name prefix (first 15 chars catches title variants)
            const namePrefix = `name:${item.name.toLowerCase().trim().slice(0, 15)}`;
            if (seen.has(namePrefix)) return false;
            seen.add(namePrefix);
          } else {
            // Places: deduplicate by exact name
            const key = `place:${item.name.toLowerCase().trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
          }
          return true;
        });
        setItems(deduped);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[useRightNow] fetch error:", err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, [portalSlug, limit]);

  return { items, loading };
}
