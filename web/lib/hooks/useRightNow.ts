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
        setItems(data);
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
